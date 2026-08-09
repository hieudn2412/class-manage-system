import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, LockKeyhole, Plus, RotateCcw, Search } from "lucide-react";
import { managementRepository } from "../../services/repositories/managementRepository";
import type { PlatformTenant } from "../../shared/types/domain";
import { ApiError } from "../../shared/types/api";
import { Badge } from "../../shared/ui/Badge";
import { Button } from "../../shared/ui/Button";
import { Input } from "../../shared/ui/FormField";
import { Modal } from "../../shared/ui/Modal";
import { Pagination } from "../../shared/ui/Pagination";
import { PageSkeleton } from "../../shared/ui/Skeleton";
import { StatePanel } from "../../shared/ui/StatePanel";
import { useToast } from "../../shared/ui/Toast";

type Action = {kind:"tenant"|"admin"|"reset"; tenant:PlatformTenant}|null;
export const PlatformTenantListPage = () => {
  const [search,setSearch]=useState(""); const [status,setStatus]=useState(""); const [page,setPage]=useState(1);
  const [createOpen,setCreateOpen]=useState(false); const [action,setAction]=useState<Action>(null);
  const [reason,setReason]=useState(""); const [credential,setCredential]=useState<{username:string,password:string}|null>(null);
  const client=useQueryClient(); const {showToast}=useToast();
  const query=new URLSearchParams({search,status,page:String(page),pageSize:"20",sort:"createdAt,desc"});
  const tenants=useQuery({queryKey:["platform-tenants",query.toString()],queryFn:()=>managementRepository.tenants(query.toString())});
  const invalidate=async()=>client.invalidateQueries({queryKey:["platform-tenants"]});
  const actionMutation=useMutation({mutationFn:async()=>{if(!action) return;
    const {tenant,kind}=action;
    if(kind==="tenant") return managementRepository.tenantStatus(tenant.id,tenant.status==="ACTIVE"?"LOCKED":"ACTIVE",reason,tenant.version);
    if(!tenant.initialAdmin) throw new Error("Admin không tồn tại");
    if(kind==="admin") return managementRepository.initialAdminStatus(tenant.id,tenant.initialAdmin.status==="ACTIVE"?"LOCKED":"ACTIVE",reason,tenant.initialAdmin.version);
    const result=await managementRepository.resetInitialAdmin(tenant.id,reason,tenant.initialAdmin.version);
    setCredential({username:tenant.initialAdmin.username,password:result.temporaryPassword}); return result;
  },onSuccess:async()=>{await invalidate();setAction(null);setReason("");showToast("Thao tác đã được ghi nhận và JWT cũ đã bị thu hồi.");}});
  if(tenants.isLoading) return <PageSkeleton/>;
  return <section className="management-page"><header className="management-header"><div><p className="eyebrow">PLATFORM / TENANTS</p><h1>Trung tâm trên hệ thống</h1><p>Tạo tenant nguyên tử và kiểm soát Admin khởi tạo mà không truy cập dữ liệu nội bộ.</p></div><Button onClick={()=>setCreateOpen(true)}><Plus size={17}/>Tạo trung tâm</Button></header>
    <div className="filter-bar"><label className="search-box"><Search size={17}/><input value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}} placeholder="Tên hoặc slug…"/></label><select value={status} onChange={e=>{setStatus(e.target.value);setPage(1)}}><option value="">Mọi trạng thái</option><option value="ACTIVE">Đang hoạt động</option><option value="LOCKED">Đã khóa</option></select></div>
    {tenants.isError?<StatePanel kind="error" title="Không tải được danh sách" description="Kiểm tra kết nối rồi thử lại." actionLabel="Thử lại" onAction={()=>void tenants.refetch()}/>:
    tenants.data?.items.length===0?<StatePanel kind="empty" title="Chưa có trung tâm" description="Tạo trung tâm đầu tiên để bắt đầu."/>:<>
    <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Trung tâm</th><th>Admin ban đầu</th><th>Trạng thái</th><th>Khởi tạo</th><th>Thao tác</th></tr></thead><tbody>{tenants.data?.items.map(t=><tr key={t.id}><td><strong>{t.name}</strong><small>/{t.slug}</small></td><td>{t.initialAdmin?<><strong>{t.initialAdmin.displayName}</strong><small>@{t.initialAdmin.username} · {t.initialAdmin.status}</small></>:"—"}</td><td><Badge tone={t.status==="ACTIVE"?"success":"danger"}>{t.status==="ACTIVE"?"Hoạt động":"Đã khóa"}</Badge></td><td>{new Date(t.createdAt).toLocaleDateString("vi-VN")}</td><td><div className="row-actions"><Button variant="secondary" onClick={()=>setAction({kind:"tenant",tenant:t})}><LockKeyhole size={15}/>{t.status==="ACTIVE"?"Khóa":"Mở"}</Button>{t.initialAdmin&&<><Button variant="ghost" onClick={()=>setAction({kind:"admin",tenant:t})}>Admin</Button><Button variant="ghost" onClick={()=>setAction({kind:"reset",tenant:t})}><RotateCcw size={15}/>Reset</Button></>}</div></td></tr>)}</tbody></table></div>
    {tenants.data&&<Pagination page={tenants.data.page} totalPages={tenants.data.totalPages} totalItems={tenants.data.totalItems} itemLabel="trung tâm" onPageChange={setPage}/>}</>}
    <CreateTenantModal open={createOpen} onClose={()=>setCreateOpen(false)} onCreated={async(username,password)=>{setCreateOpen(false);setCredential({username,password});await invalidate();}}/>
    <Modal open={Boolean(action)} title={action?.kind==="reset"?"Reset mật khẩu Admin":"Xác nhận thay đổi trạng thái"} onClose={()=>setAction(null)} confirmLabel="Xác nhận" confirmDisabled={!reason.trim()} confirmLoading={actionMutation.isPending} onConfirm={()=>actionMutation.mutate()}><p>Thao tác sẽ được audit và có hiệu lực ngay.</p><Input label="Lý do bắt buộc" value={reason} onChange={e=>setReason(e.target.value)} /></Modal>
    <Modal open={Boolean(credential)} title="Credential đã sẵn sàng" onClose={()=>setCredential(null)}><div className="credential-box"><span>Tên đăng nhập</span><strong>{credential?.username}</strong><span>Mật khẩu tạm</span><strong>{credential?.password}</strong><Button variant="secondary" onClick={()=>{void navigator.clipboard.writeText(`${credential?.username}\n${credential?.password}`);showToast("Đã sao chép credential.")}}><Copy size={16}/>Sao chép</Button></div></Modal>
  </section>;
};

const CreateTenantModal=({open,onClose,onCreated}:{open:boolean;onClose:()=>void;onCreated:(u:string,p:string)=>Promise<void>})=>{
  const [name,setName]=useState("");const [slug,setSlug]=useState("");const [username,setUsername]=useState("");const [displayName,setDisplayName]=useState("");const [email,setEmail]=useState("");const [error,setError]=useState("");
  const mutation=useMutation({mutationFn:()=>managementRepository.createTenant({name,slug,initialAdmin:{username,displayName,email:email||undefined}}),onSuccess:r=>onCreated(r.tenant.initialAdmin?.username??username,r.temporaryPassword),onError:e=>setError(e instanceof ApiError?e.message:"Không thể tạo trung tâm.")});
  return <Modal open={open} title="Tạo tenant và Admin ban đầu" onClose={onClose} confirmLabel="Tạo trung tâm" confirmDisabled={!name||!slug||!username||!displayName} confirmLoading={mutation.isPending} onConfirm={()=>mutation.mutate()}><div className="form-grid">{error&&<div className="form-alert full">{error}</div>}<Input label="Tên trung tâm" value={name} onChange={e=>setName(e.target.value)}/><Input label="Slug bất biến" value={slug} onChange={e=>setSlug(e.target.value.toLowerCase())}/><Input label="Username Admin" value={username} onChange={e=>setUsername(e.target.value)}/><Input label="Tên hiển thị Admin" value={displayName} onChange={e=>setDisplayName(e.target.value)}/><Input label="Email (không bắt buộc)" value={email} onChange={e=>setEmail(e.target.value)}/></div></Modal>;
};
