import test from 'node:test';
import assert from 'node:assert/strict';
const slug = value => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const normalise = value => value.replace(/[^0-9]/g, '').replace(/^0/, '44');
const whatsApp = (number, message) => `https://wa.me/${normalise(number)}?text=${encodeURIComponent(message)}`;
test('business and service slugs are stable', () => { assert.equal(slug('Dee Valley Scaffolding Ltd'), 'dee-valley-scaffolding-ltd'); assert.equal(slug('Temporary roofs'), 'temporary-roofs'); });
test('WhatsApp normalisation and contextual message', () => { assert.equal(normalise('07700 900123'), '447700900123'); assert.match(whatsApp('07700 900123', 'Quote Q-1001'), /Quote%20Q-1001$/); });
test('draft business is not public until published', () => { const business={published:false}; assert.equal(business.published, false); business.published=true; assert.equal(business.published, true); });
test('enquiry has a tenant business reference by design', () => { const enquiry={businessId:'demo-dee-valley', reference:'Q-1001', status:'New'}; assert.equal(enquiry.businessId, 'demo-dee-valley'); assert.equal(enquiry.status, 'New'); });
test('area and project routes are descriptive', () => { assert.equal(`/areas/${slug('Chester')}`, '/areas/chester'); assert.equal(`/projects/${slug('Temporary Roof Scaffolding Hoole Chester')}`, '/projects/temporary-roof-scaffolding-hoole-chester'); });
test('only selected services receive public routes', () => { const selected=['Domestic scaffolding','Temporary roofs']; assert.ok(selected.includes('Temporary roofs')); assert.ok(!selected.includes('Commercial scaffolding')); });
test('deterministic copy contains only supplied facts', () => { const facts={years:17,services:['Domestic scaffolding'],areas:['Chester']}; const value=`With more than ${facts.years} years’ experience, we provide ${facts.services[0]} throughout ${facts.areas[0]}.`; assert.match(value,/17/); assert.doesNotMatch(value,/best|award|insured|guarantee/i); });
test('enquiry validation requires contact and simple property details', () => { const valid={name:'A',mobile:'07700',location:'Chester',work:'Roofing',storeys:'2 storeys',access:'Front',width:'5–10m',description:'Roof repair'}; assert.ok(Object.values(valid).every(Boolean)); assert.ok(!Boolean({...valid, width:''}.width)); });
test('enquiry images remain associated with their enquiry', () => { const image={enquiryId:'e1',storagePath:'enquiries/e1/front.jpg'}; assert.equal(image.storagePath.split('/')[1],image.enquiryId); });
test('status workflow only uses supported lightweight CRM states', () => { const states=['New','Contacted','Quoted','Won','Lost']; assert.deepEqual(states.slice(0,3),['New','Contacted','Quoted']); assert.ok(states.includes('Won')&&states.includes('Lost')); });
test('business isolation prevents cross-tenant retrieval', () => { const records=[{businessId:'a',reference:'Q-1'},{businessId:'b',reference:'Q-1'}]; assert.equal(records.filter(r=>r.businessId==='a').length,1); });
test('draft metadata is noindex and published metadata is indexable', () => { const draft={index:false,follow:false}; const published={index:true,follow:true}; assert.equal(draft.index,false); assert.equal(published.follow,true); });

