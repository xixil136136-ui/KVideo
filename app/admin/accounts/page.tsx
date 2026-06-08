'use client';

import { useState, useEffect, useCallback } from 'react';

interface Account {
  id: string;
  name: string;
  role: string;
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;
}

const DURATION_PLANS = [
  { days: 30,  label: '30天', desc: '30天有效期' },
  { days: 90,  label: '90天', desc: '90天有效期' },
  { days: 365, label: '365天', desc: '365天有效期' },
];

export default function AdminAccountsPage() {
  const [session, setSession] = useState<any>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // New account form
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    password: '',
    role: 'viewer',
    duration: 0, // 0=永久
    setAsPremium: false,
  });

  // Edit account
  const [editData, setEditData] = useState<{
    id: string;
    name: string;
    role: string;
    password: string;
    expiresAt?: number;
  } | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('kvideo-admin-session');
    const token = sessionStorage.getItem('kvideo-admin-token');
    if (stored && token) {
      setSession(JSON.parse(stored));
      if (JSON.parse(stored).role !== 'super_admin') {
        window.location.href = '/admin';
      }
    } else {
      window.location.href = '/admin';
    }
  }, []);

  const getToken = () => sessionStorage.getItem('kvideo-admin-token');

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/accounts', {
        headers: { authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.valid) {
        setAccounts(data.accounts);
      } else {
        setError(data.message || '获取列表失败');
      }
    } catch {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session) fetchAccounts();
  }, [session, fetchAccounts]);

  if (!session) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/admin/accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.valid) {
        setSuccessMsg('账号创建成功！');
        setShowForm(false);
        setFormData({ name: '', password: '', role: 'viewer', duration: 0, setAsPremium: false });
        fetchAccounts();
      } else {
        setError(data.message || '创建失败');
      }
    } catch {
      setError('网络错误');
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editData) return;
    setError('');
    setSuccessMsg('');

    try {
      const body: any = { id: editData.id };
      if (editData.name) body.name = editData.name;
      if (editData.password) body.password = editData.password;
      if (editData.role) body.role = editData.role;

      const res = await fetch('/api/admin/accounts', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.valid) {
        setSuccessMsg('账号更新成功！');
        setEditData(null);
        fetchAccounts();
      } else {
        setError(data.message || '更新失败');
      }
    } catch {
      setError('网络错误');
    }
  };

  const handleExtend = async (id: string, name: string, days: number) => {
    if (!confirm(`续期「${name}」${days}天？`)) return;
    setError('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/admin/accounts', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ id, duration: days }),
      });
      const data = await res.json();
      if (data.valid) {
        setSuccessMsg(`「${name}」已续期 ${days} 天`);
        fetchAccounts();
      } else {
        setError(data.message || '续期失败');
      }
    } catch {
      setError('网络错误');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确定要删除账号「${name}」吗？`)) return;
    setError('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/admin/accounts', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.valid) {
        setSuccessMsg('账号已删除');
        fetchAccounts();
      } else {
        setError(data.message || '删除失败');
      }
    } catch {
      setError('网络错误');
    }
  };

  const roleLabel = (r: string) => {
    switch (r) {
      case 'super_admin': return '超级管理员';
      case 'admin': return '管理员';
      case 'viewer': return '查看者';
      default: return r;
    }
  };

  const roleColor = (r: string) => {
    switch (r) {
      case 'super_admin': return '#8b5cf6';
      case 'admin': return '#6366f1';
      default: return 'rgba(255,255,255,0.5)';
    }
  };

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleString('zh-CN');
  };

  const getExpiryStatus = (account: Account) => {
    if (!account.expiresAt) {
      return { text: '永久有效', color: '#22c55e', badge: '永久' };
    }
    const now = Date.now();
    if (now > account.expiresAt) {
      return { text: '已过期', color: '#ff4444', badge: '已过期' };
    }
    const days = Math.ceil((account.expiresAt - now) / (24 * 60 * 60 * 1000));
    if (days <= 7) {
      return { text: `剩余 ${days} 天`, color: '#f59e0b', badge: `⏳${days}天` };
    }
    return { text: `剩余 ${days} 天`, color: '#22c55e', badge: `${days}天` };
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%)',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '20px',
    }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: '16px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          marginBottom: '24px',
        }}>
          <div>
            <a href="/admin" style={{
              color: 'rgba(255,255,255,0.5)',
              fontSize: '14px',
              textDecoration: 'none',
              marginBottom: '4px',
              display: 'block',
            }}>← 返回控制台</a>
            <h1 style={{ color: '#fff', fontSize: '22px', margin: 0 }}>👤 账号管理</h1>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: '4px 0 0 0' }}>
              月卡 9.9元 · 季卡 19.9元 · 年卡 49.9元
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            style={{
              padding: '10px 20px',
              borderRadius: '10px',
              border: 'none',
              background: 'linear-gradient(135deg, #22c55e, #16a34a)',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {showForm ? '取消' : '+ 新建账号'}
          </button>
        </div>

        {/* Messages */}
        {error && (
          <div style={{
            background: 'rgba(255,68,68,0.1)',
            border: '1px solid rgba(255,68,68,0.3)',
            borderRadius: '12px',
            padding: '12px 16px',
            color: '#ff4444',
            fontSize: '14px',
            marginBottom: '16px',
          }}>{error}</div>
        )}
        {successMsg && (
          <div style={{
            background: 'rgba(34,197,94,0.1)',
            border: '1px solid rgba(34,197,94,0.3)',
            borderRadius: '12px',
            padding: '12px 16px',
            color: '#22c55e',
            fontSize: '14px',
            marginBottom: '16px',
          }}>{successMsg}</div>
        )}

        {/* Create Form */}
        {showForm && (
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.1)',
            padding: '24px',
            marginBottom: '24px',
          }}>
            <h2 style={{ color: '#fff', fontSize: '16px', marginBottom: '16px' }}>新建账号</h2>
            <form onSubmit={handleCreate}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <input
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="账号名称"
                  required
                  style={inputStyle}
                />
                <input
                  type="password"
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  placeholder="密码"
                  required
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
                <select
                  value={formData.role}
                  onChange={e => setFormData({ ...formData, role: e.target.value })}
                  style={selectStyle}
                >
                  <option value="viewer">查看者 (viewer)</option>
                  <option value="admin">管理员 (admin)</option>
                  <option value="super_admin">超级管理员 (super_admin)</option>
                </select>
              </div>

              {/* Duration / Pricing */}
              <div style={{ marginBottom: '16px' }}>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', marginBottom: '8px' }}>
                  选择时长：
                </p>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {DURATION_PLANS.map(plan => (
                    <label
                      key={plan.days}
                      onClick={() => setFormData({ ...formData, duration: plan.days })}
                      style={{
                        flex: 1,
                        minWidth: '110px',
                        padding: '12px 14px',
                        borderRadius: '10px',
                        border: formData.duration === plan.days
                          ? '2px solid #22c55e'
                          : '1px solid rgba(255,255,255,0.1)',
                        background: formData.duration === plan.days
                          ? 'rgba(34,197,94,0.1)'
                          : 'rgba(0,0,0,0.3)',
                        cursor: 'pointer',
                        textAlign: 'center',
                        userSelect: 'none',
                      }}
                    >
                      <div style={{ color: '#fff', fontSize: '15px', fontWeight: 600 }}>
                        {plan.label}
                      </div>
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>
                        {plan.desc}
                      </div>
                    </label>
                  ))}
                  <label
                    onClick={() => setFormData({ ...formData, duration: 0 })}
                    style={{
                      flex: 1,
                      minWidth: '110px',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: formData.duration === 0
                        ? '2px solid #6366f1'
                        : '1px solid rgba(255,255,255,0.1)',
                      background: formData.duration === 0
                        ? 'rgba(99,102,241,0.1)'
                        : 'rgba(0,0,0,0.3)',
                      cursor: 'pointer',
                      textAlign: 'center',
                      userSelect: 'none',
                    }}
                  >
                    <div style={{ color: '#fff', fontSize: '15px', fontWeight: 600 }}>
                      永久
                    </div>
                    <div style={{ color: '#818cf8', fontSize: '18px', fontWeight: 700, margin: '4px 0' }}>
                      免费
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>
                      永不过期
                    </div>
                  </label>
                </div>
              </div>

              <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', marginBottom: '16px' }}>
                <input
                  type="checkbox"
                  checked={formData.setAsPremium}
                  onChange={e => setFormData({ ...formData, setAsPremium: e.target.checked })}
                  style={{ width: '16px', height: '16px' }}
                />
                同时设为 Premium 密码
              </label>

              <button
                type="submit"
                style={{
                  padding: '10px 24px',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                创建
              </button>
            </form>
          </div>
        )}

        {/* Edit Form */}
        {editData && (
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            borderRadius: '12px',
            border: '1px solid rgba(99,102,241,0.3)',
            padding: '24px',
            marginBottom: '24px',
          }}>
            <h2 style={{ color: '#fff', fontSize: '16px', marginBottom: '16px' }}>编辑账号</h2>
            <form onSubmit={handleEdit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <input
                  value={editData.name}
                  onChange={e => setEditData({ ...editData, name: e.target.value })}
                  placeholder="账号名称"
                  style={inputStyle}
                />
                <input
                  type="password"
                  value={editData.password}
                  onChange={e => setEditData({ ...editData, password: e.target.value })}
                  placeholder="新密码（留空不修改）"
                  style={inputStyle}
                />
              </div>
              <select
                value={editData.role}
                onChange={e => setEditData({ ...editData, role: e.target.value })}
                style={{ ...selectStyle, marginBottom: '16px' }}
              >
                <option value="viewer">查看者 (viewer)</option>
                <option value="admin">管理员 (admin)</option>
                <option value="super_admin">超级管理员 (super_admin)</option>
              </select>
              {editData.expiresAt && (
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginBottom: '12px' }}>
                  过期时间：{formatDate(editData.expiresAt)}
                  {editData.expiresAt < Date.now() && (
                    <span style={{ color: '#ff4444', marginLeft: '8px' }}>（已过期，请续期）</span>
                  )}
                </p>
              )}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="submit"
                  style={{
                    padding: '10px 24px',
                    borderRadius: '10px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    color: '#fff',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  保存修改
                </button>
                <button
                  type="button"
                  onClick={() => setEditData(null)}
                  style={{
                    padding: '10px 24px',
                    borderRadius: '10px',
                    border: '1px solid rgba(255,255,255,0.15)',
                    background: 'transparent',
                    color: 'rgba(255,255,255,0.6)',
                    fontSize: '14px',
                    cursor: 'pointer',
                  }}
                >
                  取消
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Account List */}
        {loading ? (
          <p style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', padding: '40px' }}>加载中...</p>
        ) : accounts.length === 0 ? (
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.08)',
            padding: '40px',
            textAlign: 'center',
            color: 'rgba(255,255,255,0.4)',
          }}>
            暂无账号，点击右上角"新建账号"创建
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {accounts.map((account) => {
              const expiry = getExpiryStatus(account);
              const isExpired = account.expiresAt && Date.now() > account.expiresAt;
              return (
                <div key={account.id} style={{
                  background: isExpired ? 'rgba(255,68,68,0.03)' : 'rgba(255,255,255,0.03)',
                  borderRadius: '12px',
                  border: isExpired
                    ? '1px solid rgba(255,68,68,0.2)'
                    : '1px solid rgba(255,255,255,0.08)',
                  padding: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ color: '#fff', fontSize: '15px', fontWeight: 600, margin: '0 0 4px 0' }}>
                      {account.name}
                      {!account.expiresAt && (
                        <span style={{
                          fontSize: '11px',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          background: 'rgba(34,197,94,0.15)',
                          color: '#22c55e',
                          marginLeft: '8px',
                          verticalAlign: 'middle',
                        }}>永久</span>
                      )}
                    </p>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '12px',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        background: `${roleColor(account.role)}20`,
                        color: roleColor(account.role),
                      }}>
                        {roleLabel(account.role)}
                      </span>
                      <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>
                        ID: {account.id}
                      </span>
                      <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>
                        创建: {formatDate(account.createdAt)}
                      </span>
                      {/* Expiry Badge */}
                      <span style={{
                        fontSize: '12px',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        background: `${expiry.color}18`,
                        color: expiry.color,
                        fontWeight: 500,
                      }}>
                        {expiry.badge}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                    {/* Quick extend buttons */}
                    {account.expiresAt && (
                      <div style={{ display: 'flex', gap: '4px', marginRight: '8px' }}>
                        <button
                          onClick={() => handleExtend(account.id, account.name, 30)}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '6px',
                            border: '1px solid rgba(34,197,94,0.25)',
                            background: 'rgba(34,197,94,0.08)',
                            color: '#22c55e',
                            fontSize: '11px',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                          title="续期30天"
                        >+30天</button>
                        <button
                          onClick={() => handleExtend(account.id, account.name, 90)}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '6px',
                            border: '1px solid rgba(34,197,94,0.25)',
                            background: 'rgba(34,197,94,0.08)',
                            color: '#22c55e',
                            fontSize: '11px',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                          title="续期90天"
                        >+90天</button>
                        <button
                          onClick={() => handleExtend(account.id, account.name, 365)}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '6px',
                            border: '1px solid rgba(34,197,94,0.25)',
                            background: 'rgba(34,197,94,0.08)',
                            color: '#22c55e',
                            fontSize: '11px',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                          title="续期365天"
                        >+365天</button>
                      </div>
                    )}
                    <button
                      onClick={() => setEditData({
                        id: account.id,
                        name: account.name,
                        role: account.role,
                        password: '',
                        expiresAt: account.expiresAt,
                      })}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '8px',
                        border: '1px solid rgba(99,102,241,0.3)',
                        background: 'rgba(99,102,241,0.1)',
                        color: '#818cf8',
                        fontSize: '13px',
                        cursor: 'pointer',
                      }}
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => handleDelete(account.id, account.name)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '8px',
                        border: '1px solid rgba(255,68,68,0.3)',
                        background: 'rgba(255,68,68,0.1)',
                        color: '#ff4444',
                        fontSize: '13px',
                        cursor: 'pointer',
                      }}
                    >
                      删除
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: '10px',
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(0,0,0,0.3)',
  color: '#fff',
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box',
};

const selectStyle: React.CSSProperties = {
  padding: '12px 14px',
  borderRadius: '10px',
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(0,0,0,0.3)',
  color: '#fff',
  fontSize: '14px',
  outline: 'none',
  cursor: 'pointer',
};
