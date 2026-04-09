"use client";

import { useState } from 'react'
import { useRouter } from "next/navigation";
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Eye, EyeOff, Loader2, UtensilsCrossed, Lock, Mail, AlertCircle, CheckCircle2, ArrowLeft,
  Bot, LayoutDashboard,
} from 'lucide-react'

type Mode = 'login' | 'register' | 'forgot'

export default function LoginPage() {
  const { login } = useAuth()
  const router = useRouter();


  const [mode, setMode] = useState<Mode>('login')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (mode === 'forgot') {
      if (!email) { setError('Informe seu e-mail.'); return }
      setLoading(true); setError(''); setSuccess('')
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      })
      setLoading(false)
      if (resetError) {
        setError(resetError.message)
      } else {
        setSuccess('E-mail de recuperação enviado! Verifique sua caixa de entrada.')
      }
      return
    }

    if (!email || !password) { setError('Preencha todos os campos.'); return }
    if (mode === 'register' && !nome) { setError('Informe o nome do seu restaurante.'); return }
    if (password.length < 6) { setError('A senha deve ter pelo menos 6 caracteres.'); return }

    setLoading(true)
    setError('')
    setSuccess('')

    if (mode === 'login') {
      const result = await login(email, password)
      if (result.success) {
        router.push('/')
      } else {
        setError(result.error ?? 'Erro ao fazer login.')
      }
    } else {
      // Cadastro
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { nome } },
      })
      if (signUpError) {
        setError(
          signUpError.message === 'User already registered'
            ? 'Este e-mail já está cadastrado. Faça login.'
            : signUpError.message
        )
      } else {
        setSuccess('Conta criada! Verifique seu e-mail para confirmar o cadastro.')
        setMode('login')
      }
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel – branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex-col items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-white/10 blur-2xl" />
        <div className="relative z-10 max-w-md text-center space-y-8">
          <img src="/logo-icon.png" alt="Delpori" className="h-16 w-16 mx-auto drop-shadow-lg" />
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Delpori</h1>
            <p className="mt-3 text-lg text-slate-300">Gestão inteligente para delivery</p>
          </div>
          <div className="grid grid-cols-1 gap-4 text-left">
            {[
              { icon: Bot, title: 'IA no WhatsApp', desc: 'Atendimento automático 24h com inteligência artificial' },
              { icon: LayoutDashboard, title: 'Dashboard completo', desc: 'Métricas de vendas, pedidos e conversas em tempo real' },
              { icon: UtensilsCrossed, title: 'Cardápio digital', desc: 'Link de cardápio para seus clientes pedirem direto' },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-3 bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <item.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{item.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel – form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden flex flex-col items-center gap-3 mb-6">
            <img src="/logo-icon.png" alt="Delpori" className="h-14 w-14 drop-shadow-md" />
            <h1 className="text-2xl font-bold">Delpori</h1>
          </div>

          <div>
            {mode === 'forgot' && (
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); setSuccess('') }}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
              >
                <ArrowLeft className="h-4 w-4" /> Voltar ao login
              </button>
            )}
            <h2 className="text-2xl font-bold text-foreground">
              {mode === 'login' ? 'Bem-vindo de volta' : mode === 'register' ? 'Criar sua conta' : 'Recuperar senha'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === 'login'
                ? 'Entre para acessar seu painel de delivery'
                : mode === 'register'
                ? 'Comece grátis — sem cartão de crédito'
                : 'Informe seu e-mail para receber o link de recuperação'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Nome (só no cadastro) */}
            {mode === 'register' && (
              <div className="space-y-2">
                <Label htmlFor="nome">Nome do restaurante</Label>
                <Input
                  id="nome"
                  placeholder="Ex: Burguer do João"
                  value={nome}
                  onChange={(e) => { setNome(e.target.value); setError('') }}
                  disabled={loading}
                />
              </div>
            )}

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError('') }}
                  className="pl-9"
                  autoComplete="email"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Senha (oculta no modo forgot) */}
            {mode !== 'forgot' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Senha</Label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => { setMode('forgot'); setError(''); setSuccess('') }}
                      className="text-xs text-primary hover:text-primary font-medium"
                    >
                      Esqueceu a senha?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError('') }}
                    className="pl-9 pr-10"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* Erro */}
            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2.5">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Sucesso (após cadastro) */}
            {success && (
              <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg px-3 py-2.5">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{success}</span>
              </div>
            )}

            {/* Botão */}
            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-white font-semibold h-11"
              disabled={loading}
            >
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {mode === 'login' ? 'Entrando...' : mode === 'register' ? 'Criando conta...' : 'Enviando...'}
                </>
              ) : (
                mode === 'login' ? 'Entrar no painel' : mode === 'register' ? 'Criar conta grátis' : 'Enviar link de recuperação'
              )}
            </Button>
          </form>

          {/* Toggle login/cadastro */}
          {mode !== 'forgot' && (
            <p className="text-center text-sm text-muted-foreground">
              {mode === 'login' ? (
                <>Ainda não tem conta?{' '}
                  <button onClick={() => { setMode('register'); setError(''); setSuccess('') }}
                    className="text-primary hover:text-primary font-medium">
                    Criar agora
                  </button>
                </>
              ) : (
                <>Já tem conta?{' '}
                  <button onClick={() => { setMode('login'); setError(''); setSuccess('') }}
                    className="text-primary hover:text-primary font-medium">
                    Entrar
                  </button>
                </>
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
