import Link from 'next/link';
import { ArrowUpRight, Building2 } from 'lucide-react';
import { requirePagePrincipal } from '@/server/page-auth';
import { listCompanies } from '@/server/services/companies';
import { CompanyForm } from '@/components/admin-forms';
export default async function Companies() {
  const companies = await listCompanies(await requirePagePrincipal('/admin/companies'));
  return <><div className="page-heading"><div><div className="eyebrow">Company workspaces</div><h1>Companies</h1><p>Manage customer companies and the apps available to their users.</p></div><span className="badge neutral">{companies.length} companies</span></div><section className="panel"><h2>Create a company</h2><CompanyForm /></section><section className="panel"><h2>All companies</h2>{companies.length ? companies.map(company => <div className="resource" key={company.id}><div className="resource-heading"><div><Link href={`/admin/companies/${company.id}`}><h3>{company.name}</h3></Link><small className="muted">{company._count.users} users · {company._count.assignments} assigned apps</small></div><div className="row-actions"><span className={`badge ${company.active ? '' : 'neutral'}`}>{company.active ? 'Active' : 'Disabled'}</span><Link className="button secondary small" href={`/admin/companies/${company.id}`}>Manage<ArrowUpRight size={13} /></Link></div></div><details><summary>Edit company</summary><CompanyForm company={company} /></details></div>) : <div className="empty"><Building2 size={30} /><h2>Create your first company</h2><p>Company accounts keep each customer’s apps together.</p></div>}</section></>;
}
