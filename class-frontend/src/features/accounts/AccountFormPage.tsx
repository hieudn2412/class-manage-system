import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { managementRepository } from "../../services/repositories/managementRepository";
import type { ProfileType, Role } from "../../shared/types/domain";
import { ApiError } from "../../shared/types/api";
import { Button } from "../../shared/ui/Button";
import { Input, Select } from "../../shared/ui/FormField";
import { PageSkeleton } from "../../shared/ui/Skeleton";

const managementRoles:Role[]=["ADMIN","ACADEMIC_MANAGER","ACCOUNTANT"];
export const AccountFormPage=()=>{
  const {accountId,tenantSlug}=useParams(); const editing=Boolean(accountId); const navigate=useNavigate(); const {session}=useAuth(); const client=useQueryClient();
  const detail=useQuery({queryKey:["account",accountId],queryFn:()=>managementRepository.account(accountId!),enabled:editing});
  const [profile,setProfile]=useState<ProfileType>("STAFF"); const [username,setUsername]=useState(""); const [name,setName]=useState(""); const [email,setEmail]=useState(""); const [roles,setRoles]=useState<Role[]>(["ADMIN"]); const [parentName,setParentName]=useState(""); const [parentPhone,setParentPhone]=useState(""); const [error,setError]=useState("");
  useEffect(()=>{const a=detail.data;if(!a)return;
    // Query data initializes an editable draft; later server refreshes must also replace a stale draft.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProfile(a.profileType);setUsername(a.username);setName(a.displayName);setEmail(a.email??"");setRoles(a.roles);setParentName(a.parentName??"");setParentPhone(a.parentPhone??"");},[detail.data]);
  const isAdmin=session?.user.roles.includes("ADMIN")??false; const roleOptions=useMemo<Role[]>(()=>profile==="STUDENT"?["STUDENT"]:profile==="TEACHER"?["TEACHER",...(isAdmin?managementRoles:[])]:isAdmin?managementRoles:[],[profile,isAdmin]);
  const changeProfile=(p:ProfileType)=>{setProfile(p);setRoles(p==="STUDENT"?["STUDENT"]:p==="TEACHER"?["TEACHER"]:["ACADEMIC_MANAGER"]);};
  const mutation=useMutation({mutationFn:async()=>{if(editing){await managementRepository.updateAccount(accountId!,{displayName:name,email:email||undefined,roles,parentName:parentName||undefined,parentPhone:parentPhone||undefined,version:detail.data!.version});}else{await managementRepository.createAccount({profileType:profile,username,displayName:name,email:email||undefined,roles,parentName:parentName||undefined,parentPhone:parentPhone||undefined});}},onSuccess:async()=>{await client.invalidateQueries({queryKey:["accounts"]});void navigate(`/t/${tenantSlug}/app/accounts`);},onError:e=>setError(e instanceof ApiError?e.message:"Không thể lưu tài khoản.")});
  if(editing&&detail.isLoading)return <PageSkeleton/>;
  return <section className="management-page account-form-page"><Link className="back-link" to={`/t/${tenantSlug}/app/accounts`}><ArrowLeft size={16}/>Danh sách tài khoản</Link><header className="management-header"><div><p className="eyebrow">{editing?"CHỈNH SỬA":"TẠO MỚI"}</p><h1>{editing?detail.data?.displayName:"Tạo tài khoản"}</h1><p>Username, loại hồ sơ và mã GV/HS là bất biến sau khi tạo.</p></div></header>
    <form className="surface-form" onSubmit={e=>{e.preventDefault();mutation.mutate()}}>{error&&<div className="form-alert full">{error}</div>}<div className="form-grid"><Select label="Loại hồ sơ" value={profile} disabled={editing} onChange={e=>changeProfile(e.target.value as ProfileType)}><option value="STAFF" disabled={!isAdmin}>Nhân sự</option><option value="TEACHER">Giáo viên</option><option value="STUDENT">Học sinh</option></Select><Input label="Tên đăng nhập" value={username} disabled={editing} onChange={e=>setUsername(e.target.value)}/><Input label="Tên hiển thị" value={name} onChange={e=>setName(e.target.value)}/><Input label="Email" type="email" value={email} onChange={e=>setEmail(e.target.value)}/>{profile==="STUDENT"&&<><Input label="Tên phụ huynh" value={parentName} onChange={e=>setParentName(e.target.value)}/><Input label="Số điện thoại phụ huynh" value={parentPhone} onChange={e=>setParentPhone(e.target.value)}/></>}</div><fieldset className="role-fieldset"><legend>Vai trò</legend><div className="role-picker">{roleOptions.map(role=><label key={role}><input type="checkbox" checked={roles.includes(role)} disabled={role==="TEACHER"||role==="STUDENT"} onChange={e=>setRoles(e.target.checked?[...roles,role]:roles.filter(r=>r!==role))}/><span>{role}</span></label>)}</div></fieldset><div className="form-actions"><Button type="submit" loading={mutation.isPending} disabled={!username||!name||roles.length===0}><Save size={17}/>Lưu tài khoản</Button></div></form>
  </section>;
};
