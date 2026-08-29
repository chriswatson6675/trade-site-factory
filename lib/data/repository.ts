import type { Enquiry, Project } from '../domain/index';
import { business as seededBusiness, enquiries, projects } from './demo';
export type Business=typeof seededBusiness & {email?:string};
export interface Repository { loadBusiness():Business; saveBusiness(b:Business):void; loadProjects():Project[]; saveProjects(p:Project[]):void; loadEnquiries():Enquiry[]; saveEnquiries(e:Enquiry[]):void; }
const get=<T,>(key:string,fallback:T):T=>{try{return JSON.parse(localStorage.getItem(key)||'')as T}catch{return fallback}};
export const demoRepository:Repository={loadBusiness:()=>get('tsf-business',{...seededBusiness,email:'hello@deevalley-demo.co.uk'}),saveBusiness:b=>localStorage.setItem('tsf-business',JSON.stringify(b)),loadProjects:()=>get('tsf-projects',projects),saveProjects:p=>localStorage.setItem('tsf-projects',JSON.stringify(p)),loadEnquiries:()=>get('tsf-enquiries',enquiries),saveEnquiries:e=>localStorage.setItem('tsf-enquiries',JSON.stringify(e))};
