'use client';
import { FormEvent, useState } from 'react';
import { createClient } from '@/lib/supabase/browser';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function Login() {
  const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [error,setError]=useState(''); const [busy,setBusy]=useState(false); const router=useRouter();
  async function submit(e: FormEvent) { e.preventDefault(); setBusy(true); setError(''); const {error}=await createClient().auth.signInWithPassword({email,password}); if(error) setError(error.message); else router.push('/dashboard'); setBusy(false); }
  return <main className="container"><div className="card" style={{maxWidth:460,margin:'70px auto'}}><h1>Sign in</h1><form onSubmit={submit}><label>Email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} /></label><label>Password<input type="password" required value={password} onChange={e=>setPassword(e.target.value)} /></label>{error&&<div className="error">{error}</div>}<button disabled={busy}>{busy?'Signing in…':'Sign in'}</button></form><p className="muted">No account? <Link href="/signup">Create one</Link></p></div></main>;
}
