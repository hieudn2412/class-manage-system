package com.classops.backend.learningcontent;

import com.classops.backend.common.ApiException;
import com.classops.backend.learningcontent.ContentDtos.FilePurpose;
import com.classops.backend.learningcontent.ContentDtos.StoredFileView;
import com.classops.backend.security.CurrentActor;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpRange;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class FileStorageService {
    private static final Set<String> IMAGE_EXT = Set.of("jpg", "jpeg", "png", "heic");
    private static final Set<String> PDF_EXT = Set.of("pdf");
    private static final Set<String> AUDIO_EXT = Set.of("mp3", "m4a", "wav");
    private static final Set<String> OFFICE_EXT = Set.of("doc", "docx", "xls", "xlsx", "ppt", "pptx");
    private static final Set<String> TEXT_EXT = Set.of("txt");

    private final JdbcClient jdbc;
    private final CurrentActor actor;
    private final ContentProperties properties;
    private final ClamAvClient clamAv;
    private final MaintenanceWriteGuard maintenance;
    private final Clock clock;

    public FileStorageService(JdbcClient jdbc, CurrentActor actor, ContentProperties properties,
                              ClamAvClient clamAv, MaintenanceWriteGuard maintenance, Clock clock) {
        this.jdbc = jdbc;
        this.actor = actor;
        this.properties = properties;
        this.clamAv = clamAv;
        this.maintenance = maintenance;
        this.clock = clock;
    }

    @Transactional
    public StoredFileView upload(MultipartFile upload, FilePurpose purpose) {
        maintenance.requireWritable();
        UUID tenantId = actor.tenantId();
        if (upload == null || upload.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "FILE_REQUIRED", "Cần chọn file để upload.");
        }
        String original = safeFilename(upload.getOriginalFilename());
        String extension = extension(original);
        String contentType = upload.getContentType() == null
            ? "application/octet-stream" : upload.getContentType().toLowerCase(Locale.ROOT);
        long size = upload.getSize();
        validateFileType(purpose, extension, contentType, size);
        requireQuota(tenantId, size);

        UUID id = UUID.randomUUID();
        String token = UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().replace("-", "");
        OffsetDateTime expiresAt = OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC)
            .plus(properties.stagingTtl());
        Path root = properties.stagingRoot().toAbsolutePath().normalize();
        Path target = root.resolve(tenantId.toString()).resolve(id + "." + extension).normalize();
        if (!target.startsWith(root)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_FILE_PATH", "Tên file không hợp lệ.");
        }
        try {
            Files.createDirectories(target.getParent());
            upload.transferTo(target);
            verifySignature(target, extension, contentType);
            clamAv.scan(target);
            String checksum = sha256(target);
            jdbc.sql("""
                    INSERT INTO stored_files (
                      id, tenant_id, owner_user_id, status, purpose, original_filename,
                      content_type, storage_key, checksum_sha256, size_bytes, token, expires_at
                    ) VALUES (
                      :id, :tenantId, :owner, 'STAGING', :purpose, :name,
                      :contentType, :storageKey, :checksum, :size, :token, :expiresAt
                    )
                    """)
                .param("id", id).param("tenantId", tenantId).param("owner", actor.userId())
                .param("purpose", purpose.name()).param("name", original)
                .param("contentType", contentType).param("storageKey", target.toString())
                .param("checksum", checksum).param("size", size).param("token", token)
                .param("expiresAt", expiresAt).update();
            return view(id, token, original, contentType, size, checksum, expiresAt);
        } catch (IOException ex) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "FILE_WRITE_FAILED",
                "Không thể lưu file upload. Vui lòng thử lại.");
        } catch (RuntimeException ex) {
            deleteQuietly(target);
            throw ex;
        }
    }

    @Transactional
    public UUID promote(UUID tenantId, String token, FilePurpose purpose) {
        maintenance.requireWritable();
        FileRow file = jdbc.sql("""
                SELECT id, storage_key, size_bytes, purpose FROM stored_files
                WHERE tenant_id=:tenantId AND token=:token AND status='STAGING'
                  AND expires_at>now()
                FOR UPDATE
                """)
            .param("tenantId", tenantId).param("token", token)
            .query((rs, row) -> new FileRow(
                rs.getObject("id", UUID.class), rs.getString("storage_key"),
                rs.getString("purpose"), rs.getLong("size_bytes")))
            .optional().orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST,
                "STAGING_TOKEN_INVALID", "File staging không tồn tại hoặc đã hết hạn."));
        if (!purpose.name().equals(file.purpose())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "FILE_PURPOSE_MISMATCH",
                "File upload không đúng mục đích sử dụng.");
        }
        Path staging = Path.of(file.storageKey()).toAbsolutePath().normalize();
        String name = staging.getFileName().toString();
        Path root = properties.storageRoot().toAbsolutePath().normalize();
        Path target = root.resolve(tenantId.toString()).resolve(name).normalize();
        if (!target.startsWith(root)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_FILE_PATH", "Đường dẫn file không hợp lệ.");
        }
        try {
            Files.createDirectories(target.getParent());
            Files.move(staging, target, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException ex) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "FILE_FINALIZE_FAILED",
                "Không thể hoàn tất file upload.");
        }
        jdbc.sql("""
                UPDATE stored_files
                SET status='ACTIVE', token=NULL, expires_at=NULL, promoted_at=now(),
                    storage_key=:storageKey
                WHERE tenant_id=:tenantId AND id=:id
                """)
            .param("storageKey", target.toString()).param("tenantId", tenantId)
            .param("id", file.id()).update();
        return file.id();
    }

    @Transactional
    public void markDeleted(UUID tenantId, UUID fileId, String reason) {
        FileRow file = jdbc.sql("""
                SELECT id, storage_key, purpose, size_bytes FROM stored_files
                WHERE tenant_id=:tenantId AND id=:fileId AND status='ACTIVE'
                FOR UPDATE
                """)
            .param("tenantId", tenantId).param("fileId", fileId)
            .query((rs, row) -> new FileRow(rs.getObject("id", UUID.class),
                rs.getString("storage_key"), rs.getString("purpose"), rs.getLong("size_bytes")))
            .optional().orElse(null);
        if (file == null) return;
        jdbc.sql("""
                UPDATE stored_files
                SET status='DELETED', deleted_at=now(), deleted_reason=:reason
                WHERE tenant_id=:tenantId AND id=:fileId
                """)
            .param("reason", reason).param("tenantId", tenantId).param("fileId", fileId).update();
        deleteQuietly(Path.of(file.storageKey()));
    }

    @Transactional(readOnly = true)
    public StoredFileView file(UUID tenantId, UUID fileId) {
        return jdbc.sql("""
                SELECT id, token, original_filename, content_type, checksum_sha256,
                       size_bytes, expires_at
                FROM stored_files
                WHERE tenant_id=:tenantId AND id=:fileId AND status<>'DELETED'
                """)
            .param("tenantId", tenantId).param("fileId", fileId)
            .query((rs, row) -> view(
                rs.getObject("id", UUID.class), rs.getString("token"),
                rs.getString("original_filename"), rs.getString("content_type"),
                rs.getLong("size_bytes"), rs.getString("checksum_sha256"),
                rs.getObject("expires_at", OffsetDateTime.class)))
            .optional().orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                "FILE_NOT_FOUND", "Không tìm thấy file."));
    }

    @Transactional(readOnly = true)
    public ResponseEntity<Resource> response(UUID tenantId, UUID fileId, String rangeHeader) {
        FileDownload file = jdbc.sql("""
                SELECT original_filename, content_type, storage_key, size_bytes
                FROM stored_files
                WHERE tenant_id=:tenantId AND id=:fileId AND status='ACTIVE'
                """)
            .param("tenantId", tenantId).param("fileId", fileId)
            .query((rs, row) -> new FileDownload(rs.getString("original_filename"),
                rs.getString("content_type"), rs.getString("storage_key"), rs.getLong("size_bytes")))
            .optional().orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                "FILE_NOT_FOUND", "Không tìm thấy file."));
        Path path = Path.of(file.storageKey()).toAbsolutePath().normalize();
        if (!Files.exists(path)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "FILE_BLOB_MISSING",
                "Blob của file không còn tồn tại.");
        }
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType(file.contentType()));
        headers.set(HttpHeaders.ACCEPT_RANGES, "bytes");
        headers.set(HttpHeaders.CONTENT_DISPOSITION,
            "inline; filename*=UTF-8''" + URLEncoder.encode(file.filename(), StandardCharsets.UTF_8));
        if (rangeHeader != null && !rangeHeader.isBlank()) {
            List<HttpRange> ranges = HttpRange.parseRanges(rangeHeader);
            if (!ranges.isEmpty()) {
                HttpRange range = ranges.get(0);
                long start = range.getRangeStart(file.sizeBytes());
                long end = range.getRangeEnd(file.sizeBytes());
                long length = end - start + 1;
                headers.set(HttpHeaders.CONTENT_RANGE, "bytes " + start + "-" + end + "/" + file.sizeBytes());
                headers.setContentLength(length);
                try {
                    InputStream stream = Files.newInputStream(path);
                    stream.skipNBytes(start);
                    return ResponseEntity.status(HttpStatus.PARTIAL_CONTENT)
                        .headers(headers)
                        .body(new RangeResource(new BoundedInputStream(stream, length), file.filename()));
                } catch (IOException ex) {
                    throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "FILE_READ_FAILED",
                        "Không đọc được file.");
                }
            }
        }
        FileSystemResource resource = new FileSystemResource(path);
        headers.setContentLength(file.sizeBytes());
        return ResponseEntity.ok().headers(headers).body(resource);
    }

    @Transactional
    public void cleanupExpiredStaging() {
        List<FileRow> expired = jdbc.sql("""
                SELECT id, storage_key, purpose, size_bytes FROM stored_files
                WHERE status='STAGING' AND expires_at<now()
                LIMIT 200
                """)
            .query((rs, row) -> new FileRow(rs.getObject("id", UUID.class),
                rs.getString("storage_key"), rs.getString("purpose"), rs.getLong("size_bytes")))
            .list();
        for (FileRow file : expired) {
            jdbc.sql("""
                    UPDATE stored_files SET status='DELETED', token=NULL, expires_at=NULL,
                        deleted_at=now(), deleted_reason='expired staging cleanup'
                    WHERE id=:id AND status='STAGING'
                    """)
                .param("id", file.id()).update();
            deleteQuietly(Path.of(file.storageKey()));
        }
    }

    @Transactional(readOnly = true)
    public Usage usage(UUID tenantId) {
        long quota = quota(tenantId);
        UsageRows rows = jdbc.sql("""
                SELECT
                  COALESCE(sum(size_bytes) FILTER (WHERE status<>'DELETED'),0) AS used_bytes,
                  COALESCE(sum(size_bytes) FILTER (WHERE status='STAGING'),0) AS staging_bytes
                FROM stored_files
                WHERE tenant_id=:tenantId
                """)
            .param("tenantId", tenantId)
            .query((rs, row) -> new UsageRows(rs.getLong("used_bytes"), rs.getLong("staging_bytes")))
            .single();
        long version = jdbc.sql("""
                SELECT COALESCE((SELECT version FROM tenant_storage_quotas
                  WHERE tenant_id=:tenantId), 0)
                """)
            .param("tenantId", tenantId).query(Long.class).single();
        return new Usage(quota, rows.usedBytes(), rows.stagingBytes(), version);
    }

    @Transactional
    public long updateQuota(UUID tenantId, long quotaBytes, long expectedVersion) {
        if (quotaBytes <= 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_QUOTA",
                "Quota phải lớn hơn 0 byte.");
        }
        long current = quota(tenantId);
        Usage usage = usage(tenantId);
        if (quotaBytes < usage.usedBytes()) {
            throw new ApiException(HttpStatus.CONFLICT, "QUOTA_BELOW_USAGE",
                "Quota mới nhỏ hơn dung lượng đang sử dụng.", Map.of("usedBytes", usage.usedBytes()));
        }
        long version = jdbc.sql("""
                INSERT INTO tenant_storage_quotas (tenant_id, quota_bytes, updated_by, version)
                VALUES (:tenantId, :quotaBytes, :actorId, 0)
                ON CONFLICT (tenant_id) DO UPDATE
                SET quota_bytes=:quotaBytes, updated_by=:actorId, updated_at=now(),
                    version=tenant_storage_quotas.version+1
                WHERE tenant_storage_quotas.version=:version
                RETURNING version
                """)
            .param("tenantId", tenantId).param("quotaBytes", quotaBytes)
            .param("actorId", actor.userId()).param("version", expectedVersion)
            .query(Long.class).optional().orElseThrow(() -> new ApiException(HttpStatus.CONFLICT,
                "OPTIMISTIC_LOCK_CONFLICT", "Quota tenant đã được thay đổi. Vui lòng tải lại."));
        return current == quotaBytes ? usage.version() : version;
    }

    private long quota(UUID tenantId) {
        return jdbc.sql("""
                SELECT COALESCE((SELECT quota_bytes FROM tenant_storage_quotas
                  WHERE tenant_id=:tenantId), :defaultQuota)
                """)
            .param("tenantId", tenantId)
            .param("defaultQuota", properties.defaultTenantQuotaBytes())
            .query(Long.class).single();
    }

    private void requireQuota(UUID tenantId, long additionalBytes) {
        Usage usage = usage(tenantId);
        if (usage.usedBytes() + additionalBytes > usage.quotaBytes()) {
            throw new ApiException(HttpStatus.CONFLICT, "TENANT_QUOTA_EXCEEDED",
                "Dung lượng tenant không đủ để upload file này.",
                Map.of("quotaBytes", usage.quotaBytes(), "usedBytes", usage.usedBytes(),
                    "requestedBytes", additionalBytes));
        }
    }

    private void validateFileType(FilePurpose purpose, String extension, String contentType, long size) {
        boolean allowed = IMAGE_EXT.contains(extension) || PDF_EXT.contains(extension)
            || AUDIO_EXT.contains(extension) || OFFICE_EXT.contains(extension) || TEXT_EXT.contains(extension);
        if (!allowed) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "FILE_TYPE_NOT_ALLOWED",
                "Định dạng file không được hỗ trợ.");
        }
        if (purpose == FilePurpose.SUBMISSION_IMAGE && !IMAGE_EXT.contains(extension)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "SUBMISSION_IMAGE_REQUIRED",
                "Bài nộp chỉ nhận JPG/PNG/HEIC.");
        }
        long limit = AUDIO_EXT.contains(extension) ? properties.audioLimitBytes()
            : purpose == FilePurpose.SUBMISSION_IMAGE ? properties.submissionImageLimitBytes()
            : properties.documentLimitBytes();
        if (size > limit) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "FILE_TOO_LARGE",
                "File vượt giới hạn dung lượng.", Map.of("limitBytes", limit));
        }
        if (contentType.contains("html") || contentType.contains("svg")
            || contentType.contains("zip") && !OFFICE_EXT.contains(extension)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "FILE_TYPE_NOT_ALLOWED",
                "Định dạng file không được hỗ trợ.");
        }
    }

    private void verifySignature(Path path, String extension, String contentType) {
        try (InputStream in = Files.newInputStream(path)) {
            byte[] head = in.readNBytes(16);
            boolean ok = switch (extension) {
                case "jpg", "jpeg" -> head.length >= 3 && head[0] == (byte) 0xff
                    && head[1] == (byte) 0xd8 && head[2] == (byte) 0xff;
                case "png" -> head.length >= 8 && head[0] == (byte) 0x89 && head[1] == 0x50
                    && head[2] == 0x4e && head[3] == 0x47;
                case "pdf" -> starts(head, "%PDF");
                case "wav" -> starts(head, "RIFF");
                case "mp3" -> starts(head, "ID3") || (head.length >= 2 && head[0] == (byte) 0xff);
                case "m4a", "heic" -> head.length >= 12 && new String(head, 4, 4, StandardCharsets.US_ASCII).equals("ftyp");
                case "docx", "xlsx", "pptx" -> head.length >= 4 && head[0] == 0x50 && head[1] == 0x4b;
                case "doc", "xls", "ppt" -> head.length >= 8 && head[0] == (byte) 0xd0 && head[1] == (byte) 0xcf;
                case "txt" -> contentType.startsWith("text/") || contentType.equals("application/octet-stream");
                default -> false;
            };
            if (!ok) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "FILE_SIGNATURE_MISMATCH",
                    "Nội dung file không khớp định dạng khai báo.");
            }
        } catch (IOException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "FILE_SIGNATURE_UNREADABLE",
                "Không thể đọc file để kiểm tra định dạng.");
        }
    }

    private boolean starts(byte[] bytes, String prefix) {
        byte[] expected = prefix.getBytes(StandardCharsets.US_ASCII);
        if (bytes.length < expected.length) return false;
        for (int i = 0; i < expected.length; i++) {
            if (bytes[i] != expected[i]) return false;
        }
        return true;
    }

    private String sha256(Path path) throws IOException {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            try (DigestInputStream input = new DigestInputStream(Files.newInputStream(path), digest)) {
                input.transferTo(OutputStream.nullOutputStream());
            }
            return HexFormat.of().formatHex(digest.digest());
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException(ex);
        }
    }

    private StoredFileView view(UUID id, String token, String filename, String contentType,
                                long sizeBytes, String checksum, OffsetDateTime expiresAt) {
        String url = "/api/v1/files/" + id + "/content";
        return new StoredFileView(id, token, filename, contentType, sizeBytes, checksum,
            expiresAt, url, url);
    }

    private String safeFilename(String name) {
        String value = name == null || name.isBlank() ? "upload.bin" : name.trim();
        value = value.replace("\\", "/");
        value = value.substring(value.lastIndexOf('/') + 1);
        if (value.contains("..")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_FILENAME", "Tên file không hợp lệ.");
        }
        return value;
    }

    private String extension(String filename) {
        int index = filename.lastIndexOf('.');
        if (index < 0 || index == filename.length() - 1) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "FILE_EXTENSION_REQUIRED",
                "File cần có phần mở rộng hợp lệ.");
        }
        return filename.substring(index + 1).toLowerCase(Locale.ROOT);
    }

    private void deleteQuietly(Path path) {
        try {
            Files.deleteIfExists(path);
        } catch (IOException ignored) {
        }
    }

    public record Usage(long quotaBytes, long usedBytes, long stagingBytes, long version) {
    }

    private record UsageRows(long usedBytes, long stagingBytes) {
    }

    private record FileRow(UUID id, String storageKey, String purpose, long sizeBytes) {
    }

    private record FileDownload(String filename, String contentType, String storageKey, long sizeBytes) {
    }

    private static final class RangeResource extends org.springframework.core.io.InputStreamResource {
        private final String filename;

        private RangeResource(InputStream inputStream, String filename) {
            super(inputStream);
            this.filename = filename;
        }

        @Override
        public String getFilename() {
            return filename;
        }
    }

    private static final class BoundedInputStream extends FilterInputStream {
        private long remaining;

        private BoundedInputStream(InputStream in, long remaining) {
            super(in);
            this.remaining = remaining;
        }

        @Override
        public int read() throws IOException {
            if (remaining <= 0) {
                return -1;
            }
            int result = super.read();
            if (result != -1) {
                remaining--;
            }
            return result;
        }

        @Override
        public int read(byte[] buffer, int offset, int length) throws IOException {
            if (remaining <= 0) {
                return -1;
            }
            int allowed = (int) Math.min(length, remaining);
            int read = super.read(buffer, offset, allowed);
            if (read != -1) {
                remaining -= read;
            }
            return read;
        }
    }
}
