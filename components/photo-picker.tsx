/* eslint-disable @next/next/no-img-element */
'use client';
import { ChangeEvent, useState } from 'react';
import { imageSizeValid, imageTypeValid } from '../lib/domain';

type Props={images:string[];onChange:(images:string[])=>void;label?:string};
export function PhotoPicker({images,onChange,label='TAKE OR CHOOSE PHOTOS'}:Props){
 const[error,setError]=useState('');
 const pick=async(event:ChangeEvent<HTMLInputElement>)=>{
  const files=Array.from(event.target.files||[]);
  setError('');
  if(images.length+files.length>6){setError('You can add up to 6 photos. Remove one before adding another.');event.target.value='';return}
  const wrong=files.find(file=>!imageTypeValid(file));
  if(wrong){setError(`${wrong.name} is not an image. Choose JPG, PNG, HEIC or another image file.`);event.target.value='';return}
  const large=files.find(file=>!imageSizeValid(file));
  if(large){setError(`${large.name} is larger than 10 MB. Choose a smaller photo.`);event.target.value='';return}
  try{const encoded=await Promise.all(files.map(file=>new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(reader.error);reader.readAsDataURL(file)})));onChange([...images,...encoded])}catch{setError('One of those photos could not be read. Please try again.')}finally{event.target.value=''}
 };
 return <div className="photo-picker"><label className="upload">{label}<input type="file" accept="image/*" capture="environment" multiple onChange={pick}/></label><p className="hint">Up to 6 photos, 10 MB each.</p>{error&&<p className="error" role="alert">{error}</p>}<div className="thumbs">{images.map((src,index)=><div key={`${src.slice(0,40)}-${index}`}><button type="button" aria-label={`Remove photo ${index+1}`} onClick={()=>onChange(images.filter((_,item)=>item!==index))}>×</button><a href={src} target="_blank" rel="noreferrer" aria-label={`View photo ${index+1}`}><img src={src} alt={`Selected photo ${index+1}`}/></a></div>)}</div></div>
}
