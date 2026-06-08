'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem('kvideo-admin-session');
    const token = sessionStorage.getItem('kvideo-admin-token');
    if (stored && token) {
      setSession(JSON.parse(stored));
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();

      if (data.valid) {
        const sessionInfo = { name: data.name, role: data.role, profileId: data.profileId };
        // Create a proper session token: UTF-8-safe base64-encoded JSON
        const sessionToken = btoa(
          new TextEncoder().encode(JSON.stringify({
            id: data.profileId,
            name: data.name,
            role: data.role,
            exp: Date.now() + 24 * 60 * 60 * 1000,
          })).reduce((s, b) => s + String.fromCharCode(b), '')
        );
        sessionStorage.setItem('kvideo-admin-session', JSON.stringify(sessionInfo));
        sessionStorage.setItem('kvideo-admin-token', sessionToken);
        setSession(sessionInfo);
        setPassword('');
      } else {
        setError(data.message || '登录失败');
      }
    } catch (err) {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('kvideo-admin-session');
    sessionStorage.removeItem('kvideo-admin-token');
    setSession(null);
  };

  // ============ NOT LOGGED IN: Login Form ============
  if (!session) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '20px',
      }}>
        {/* Login Card */}
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          backdropFilter: 'blur(20px)',
          borderRadius: '20px',
          padding: '48px 40px',
          width: '100%',
          maxWidth: '420px',
          border: '1px solid rgba(255,255,255,0.1)',
        }}>
          <div style={{
            fontSize: '12px',
            fontWeight: 600,
            color: 'rgba(255,255,255,0.3)',
            letterSpacing: '2px',
            textTransform: 'uppercase' as const,
            marginBottom: '8px',
          }}>VIP 会员</div>
          <h1 style={{
            fontSize: '28px',
            fontWeight: 700,
            color: '#fff',
            marginBottom: '4px',
          }}>NB影院</h1>
          <p style={{
            fontSize: '14px',
            color: 'rgba(255,255,255,0.4)',
            marginBottom: '32px',
          }}>输入会员密码解锁全部内容</p>

          <form onSubmit={handleLogin}>
            <div style={{
              position: 'relative' as const,
              marginBottom: '16px',
            }}>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="输入会员密码"
                autoFocus
                style={{
                  width: '100%',
                  padding: '16px 16px 16px 48px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(0,0,0,0.3)',
                  color: '#fff',
                  fontSize: '16px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.5)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
              <span style={{
                position: 'absolute',
                left: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: '18px',
                opacity: 0.4,
              }}>🔑</span>
            </div>

            {error && (
              <p style={{ color: '#ff4444', fontSize: '14px', marginBottom: '12px', textAlign: 'center' }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: '12px',
                border: 'none',
                background: loading
                  ? 'rgba(99,102,241,0.5)'
                  : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: '#fff',
                fontSize: '16px',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                boxShadow: loading
                  ? 'none'
                  : '0 4px 15px rgba(99,102,241,0.3)',
              }}
            >
              {loading ? '验证中...' : '解锁观影 ▶'}
            </button>
          </form>
        </div>
    );
  }

  // ============ LOGGED IN: Dashboard ============
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%)',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '20px',
    }}>
      {/* Header */}
      <div style={{
        maxWidth: '1000px',
        margin: '0 auto',
        paddingBottom: '20px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        marginBottom: '24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <h1 style={{ color: '#fff', fontSize: '22px', margin: 0 }}>NB影院 管理后台</h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginTop: '4px' }}>
            {session.name} · {session.role === 'super_admin' ? '超级管理员' : session.role === 'admin' ? '管理员' : '查看者'}
          </p>
        </div>
        <button
          onClick={handleLogout}
          style={{
            padding: '8px 20px',
            borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.15)',
            background: 'rgba(255,255,255,0.05)',
            color: 'rgba(255,255,255,0.7)',
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          退出登录
        </button>
      </div>

      {/* Navigation */}
      <div style={{ maxWidth: '1000px', margin: '0 auto', marginBottom: '24px' }}>
        <div style={{
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
        }}>
          <a
            href="/admin"
            style={{
              padding: '10px 20px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 600,
              textDecoration: 'none',
              cursor: 'pointer',
            }}
          >
            📊 控制台
          </a>
          {session.role === 'super_admin' && (
            <a
              href="/admin/accounts"
              style={{
                padding: '10px 20px',
                borderRadius: '10px',
                background: 'rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.8)',
                fontSize: '14px',
                fontWeight: 500,
                textDecoration: 'none',
                cursor: 'pointer',
              }}
            >
              👤 账号管理
            </a>
          )}
        </div>
      </div>

      {/* Dashboard Cards */}
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}>
          <DashboardCard title="登录状态" value="已登录" color="#22c55e" />
          <DashboardCard title="角色" value={session.role === 'super_admin' ? '超级管理员' : session.role} color="#6366f1" />
          <DashboardCard title="会话有效期" value="24小时" color="#f59e0b" />
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.03)',
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.08)',
          padding: '24px',
        }}>
          <h2 style={{ color: '#fff', fontSize: '18px', marginBottom: '12px' }}>操作指南</h2>
          <ul style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', lineHeight: '1.8', paddingLeft: '20px' }}>
            <li>前往 <strong style={{ color: 'rgba(255,255,255,0.9)' }}>账号管理</strong> 创建/编辑/删除管理员账号</li>
            <li>每个账号可设置不同的角色权限</li>
            <li>创建账号时可同时设为 Premium 密码</li>
            <li>修改后无需重启，立即生效</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function DashboardCard({ title, value, color }: { title: string; value: string; color: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      borderRadius: '12px',
      border: '1px solid rgba(255,255,255,0.08)',
      padding: '20px',
    }}>
      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginBottom: '8px' }}>{title}</p>
      <p style={{
        color: color,
        fontSize: '20px',
        fontWeight: 700,
        margin: 0,
      }}>{value}</p>
    </div>
  );
}
