import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient(); const { data:{user} } = await supabase.auth.getUser(); if(!user) return NextResponse.json({error:'Unauthorized'},{status:401});
  const {id}=await params; const body=await request.json(); const updates:{name?:string;description?:string|null}={};
  if(typeof body.name==='string'){const name=body.name.trim();if(!name||name.length>120)return NextResponse.json({error:'Invalid project name'},{status:400});updates.name=name;}
  if(body.description===null||typeof body.description==='string')updates.description=body.description;
  const {data,error}=await supabase.from('projects').update(updates).eq('id',id).select('*').single(); if(error)return NextResponse.json({error:'Project not found or not owned by current user'},{status:404}); return NextResponse.json(data);
}
export async function DELETE(_:Request,{params}:{params:Promise<{id:string}>}){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});const {id}=await params;const {error}=await supabase.from('projects').delete().eq('id',id);if(error)return NextResponse.json({error:error.message},{status:400});return new NextResponse(null,{status:204});}
