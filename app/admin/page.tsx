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
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();

      if (data.valid) {
        sessionStorage.setItem('kvideo-admin-session', JSON.stringify(data.session));
        sessionStorage.setItem('kvideo-admin-token', data.sessionToken);
        setSession(data.session);
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
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '20px',
      }}>
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          backdropFilter: 'blur(20px)',
          borderRadius: '16px',
          padding: '40px',
          width: '100%',
          maxWidth: '400px',
          border: '1px solid rgba(255,255,255,0.1)',
        }}>
          <h1 style={{
            fontSize: '24px',
            fontWeight: 700,
            color: '#fff',
            marginBottom: '8px',
            textAlign: 'center',
          }}>KVideo 管理后台</h1>
          <p style={{
            fontSize: '14px',
            color: 'rgba(255,255,255,0.5)',
            marginBottom: '32px',
            textAlign: 'center',
          }}>输入管理员密码登录</p>

          <form onSubmit={handleLogin}>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="管理员密码"
              autoFocus
              style={{
                width: '100%',
                padding: '14px 16px',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(0,0,0,0.3)',
                color: '#fff',
                fontSize: '16px',
                outline: 'none',
                boxSizing: 'border-box',
                marginBottom: '16px',
              }}
            />

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
                padding: '14px',
                borderRadius: '12px',
                border: 'none',
                background: loading ? 'rgba(99,102,241,0.5)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: '#fff',
                fontSize: '16px',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {loading ? '验证中...' : '登录'}
            </button>
          </form>
        </div>
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
          <h1 style={{ color: '#fff', fontSize: '22px', margin: 0 }}>KVideo 管理后台</h1>
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
