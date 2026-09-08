'use client';
import { FormEvent, useState } from 'react';
import { createClient } from '@/lib/supabase/browser';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function Signup() {
  const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [error,setError]=useState(''); const [message,setMessage]=useState(''); const [busy,setBusy]=useState(false); const router=useRouter();
  async function submit(e: FormEvent) { e.preventDefault(); setBusy(true); setError(''); setMessage(''); const {data,error}=await createClient().auth.signUp({email,password}); if(error) setError(error.message); else if(data.session) router.push('/dashboard'); else setMessage('Account created. Check your email if confirmation is enabled.'); setBusy(false); }
  return <main className="container"><div className="card" style={{maxWidth:460,margin:'70px auto'}}><h1>Create account</h1><form onSubmit={submit}><label>Email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} /></label><label>Password<input type="password" minLength={8} required value={password} onChange={e=>setPassword(e.target.value)} /></label>{error&&<div className="error">{error}</div>}{message&&<div className="card">{message}</div>}<button disabled={busy}>{busy?'Creating…':'Create account'}</button></form><p className="muted">Already registered? <Link href="/login">Sign in</Link></p></div></main>;
}
