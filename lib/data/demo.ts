import type { Enquiry, Project } from '../domain/index.ts';
export const business={id:'demo-dee-valley',slug:'dee-valley-scaffolding',name:'Dee Valley Scaffolding Ltd',town:'Chester',phone:'01244 555 018',whatsapp:'447700900123',years:17,services:['Domestic scaffolding','Commercial scaffolding','Temporary roof','Roofing access'],areas:['Chester','Wrexham','Mold','North Wales']};
export const projects:Project[]=[
 {id:'p1',businessId:business.id,slug:'temporary-roof-scaffolding-hoole-chester',title:'Temporary Roof Scaffolding',service:'Temporary roof',location:'Hoole, Chester',description:'Temporary weather protection for a residential reroof.',published:true,images:[]},
 {id:'p2',businessId:business.id,slug:'residential-access-wrexham',title:'Residential Access Scaffolding',service:'Domestic scaffolding',location:'Wrexham',description:'Safe access for a home improvement project.',published:true,images:[]},
 {id:'p3',businessId:business.id,slug:'commercial-scaffolding-mold',title:'Commercial Scaffolding',service:'Commercial scaffolding',location:'Mold',description:'Planned access for commercial works.',published:true,images:[]}
];
export const enquiries:Enquiry[]=[{id:'e1',businessId:business.id,reference:'Q-1001',name:'John Smith',mobile:'07700 900456',location:'Chester',preferredContact:'WhatsApp',work:'Roofing',storeys:'2 storeys',access:'Front + side',width:'5–10m',description:'Roofers are replacing slate roof. Side access available.',photos:[],status:'new'}];
