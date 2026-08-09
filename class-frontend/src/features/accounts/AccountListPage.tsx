import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LockKeyhole, Plus, RotateCcw, Search } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { managementRepository } from "../../services/repositories/managementRepository";
import type { Account } from "../../shared/types/domain";
import { Badge } from "../../shared/ui/Badge";
import { Button } from "../../shared/ui/Button";
import { Input } from "../../shared/ui/FormField";
import { Modal } from "../../shared/ui/Modal";
import { Pagination } from "../../shared/ui/Pagination";
import { PageSkeleton } from "../../shared/ui/Skeleton";
import { StatePanel } from "../../shared/ui/StatePanel";
import { useToast } from "../../shared/ui/Toast";

export const AccountListPage=()=>{
  const {tenantSlug}=useParams(); const base=`/t/${tenantSlug}/app/accounts`;
  const [search,setSearch]=useState(""); const [status,setStatus]=useState(""); const [profile,setProfile]=useState(""); const [page,setPage]=useState(1);
  const [target,setTarget]=useState<{account:Account;kind:"status"|"reset"}|null>(null); const [reason,setReason]=useState(""); const [password,setPassword]=useState("");
  const client=useQueryClient(); const {showToast}=useToast();
  const qs=new URLSearchParams({search,status,profileType:profile,page:String(page),pageSize:"20",sort:"createdAt,desc"});
  const query=useQuery({queryKey:["accounts",qs.toString()],queryFn:()=>managementRepository.accounts(qs.toString())});
  const mutation=useMutation({mutationFn:async()=>{if(!target)return;if(target.kind==="status")return managementRepository.accountStatus(target.account.id,target.account.status==="ACTIVE"?"LOCKED":"ACTIVE",reason,target.account.version);const r=await managementRepository.resetAccount(target.account.id,reason,target.account.version);setPassword(r.temporaryPassword);return r;},onSuccess:async()=>{await client.invalidateQueries({queryKey:["accounts"]});setTarget(null);setReason("");showToast("Tài khoản đã cập nhật; phiên cũ không còn hiệu lực.");}});
  if(query.isLoading)return <PageSkeleton/>;
  return <section className="management-page"><header className="management-header"><div><p className="eyebrow">TENANT / ACCOUNTS</p><h1>Người dùng trung tâm</h1><p>Tài khoản, vai trò và hồ sơ GV/HS trong đúng tenant hiện tại.</p></div><Link className="button" to={`${base}/new`}><Plus size={17}/>Tạo tài khoản</Link></header>
    <div className="filter-bar"><label className="search-box"><Search size={17}/><input value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}} placeholder="Tên, username, email hoặc mã…"/></label><select value={profile} onChange={e=>setProfile(e.target.value)}><option value="">Mọi loại hồ sơ</option><option value="STAFF">Nhân sự</option><option value="TEACHER">Giáo viên</option><option value="STUDENT">Học sinh</option></select><select value={status} onChange={e=>setStatus(e.target.value)}><option value="">Mọi trạng thái</option><option value="ACTIVE">Hoạt động</option><option value="LOCKED">Đã khóa</option></select></div>
    {query.isError?<StatePanel kind="error" title="Không tải được tài khoản" description="Kiểm tra kết nối rồi thử lại." actionLabel="Thử lại" onAction={()=>void query.refetch()}/>:query.data?.items.length===0?<StatePanel kind="empty" title="Không có tài khoản phù hợp" description="Thay đổi bộ lọc hoặc tạo tài khoản mới."/>:<><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Tài khoản</th><th>Hồ sơ</th><th>Vai trò</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{query.data?.items.map(a=><tr key={a.id}><td><Link to={`${base}/${a.id}`}><strong>{a.displayName}</strong></Link><small>@{a.username} {a.email&&`· ${a.email}`}</small></td><td><strong>{a.code??({STAFF:"Nhân sự",TEACHER:"Giáo viên",STUDENT:"Học sinh"}[a.profileType])}</strong><small>{a.profileType}</small></td><td><div className="badge-row">{a.roles.map(r=><Badge key={r}>{r}</Badge>)}</div></td><td><Badge tone={a.status==="ACTIVE"?"success":"danger"}>{a.status==="ACTIVE"?"Hoạt động":"Đã khóa"}</Badge></td><td><div className="row-actions"><Button variant="secondary" onClick={()=>setTarget({account:a,kind:"status"})}><LockKeyhole size={15}/>{a.status==="ACTIVE"?"Khóa":"Mở"}</Button><Button variant="ghost" onClick={()=>setTarget({account:a,kind:"reset"})}><RotateCcw size={15}/>Reset</Button></div></td></tr>)}</tbody></table></div>{query.data&&<Pagination page={query.data.page} totalPages={query.data.totalPages} totalItems={query.data.totalItems} itemLabel="tài khoản" onPageChange={setPage}/>}</>}
    <Modal open={Boolean(target)} title={target?.kind==="reset"?"Reset mật khẩu":"Đổi trạng thái tài khoản"} onClose={()=>setTarget(null)} confirmLabel="Xác nhận" confirmDisabled={!reason.trim()} confirmLoading={mutation.isPending} onConfirm={()=>mutation.mutate()}><p>Nhập lý do để lưu audit. JWT cũ sẽ bị thu hồi.</p><Input label="Lý do" value={reason} onChange={e=>setReason(e.target.value)}/></Modal>
    <Modal open={Boolean(password)} title="Mật khẩu tạm mới" onClose={()=>setPassword("")}><div className="credential-box"><span>Mật khẩu</span><strong>{password}</strong><Button variant="secondary" onClick={()=>void navigator.clipboard.writeText(password)}>Sao chép</Button></div></Modal>
  </section>;
};
