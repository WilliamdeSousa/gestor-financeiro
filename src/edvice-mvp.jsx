import React, { useState, useEffect } from 'react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import {
  Home, Receipt, FolderOpen, CreditCard, PieChart as PieIcon, Plus, X,
  TrendingUp, TrendingDown, ChevronLeft, ChevronRight, AlertTriangle,
  Trash2, ArrowLeft, Wallet, Pencil, Repeat,
} from 'lucide-react';

/* ----------------------------- helpers ----------------------------- */
const pad = (n) => String(n).padStart(2, '0');
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseISO = (iso) => new Date(`${iso}T00:00:00`);
const addDays = (date, n) => { const d = new Date(date); d.setDate(d.getDate() + n); return d; };
const addMonthsClamped = (base, n) => {
  const d = new Date(base.getFullYear(), base.getMonth() + n + 1, 0); // último dia do mês alvo
  d.setDate(Math.min(base.getDate(), d.getDate()));
  return d;
};
const stripInstallmentSuffix = (desc) => desc.replace(/\s*\(\d+\/\d+\)\s*$/, '');
const seriesDescription = (t, baseDesc) => (t.groupId && !t.recurrence ? `${baseDesc} (${t.installmentIndex}/${t.installmentTotal})` : baseDesc);

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const fmtDate = (iso) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };

const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const today = new Date();
const todayISO = toISO(today);

const inputClass = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400';

/* ----------------------------- seed data ----------------------------- */
const initialExpenseCategories = [
  { id: 'alimentacao', name: 'Alimentação', budget: 800, color: '#f97316' },
  { id: 'transporte', name: 'Transporte', budget: 250, color: '#3b82f6' },
  { id: 'moradia', name: 'Moradia', budget: 1200, color: '#8b5cf6' },
  { id: 'lazer', name: 'Lazer', budget: 200, color: '#ec4899' },
  { id: 'saude', name: 'Saúde', budget: 150, color: '#22c55e' },
  { id: 'educacao', name: 'Educação', budget: 100, color: '#06b6d4' },
  { id: 'outros', name: 'Outros', budget: 100, color: '#94a3b8' },
];

const initialIncomeCategories = [
  { id: 'salario', name: 'Salário', budget: 0, color: '#16a34a' },
  { id: 'freelance', name: 'Freelance', budget: 0, color: '#0ea5e9' },
  { id: 'outros-r', name: 'Outros', budget: 0, color: '#94a3b8' },
];

const initialTags = ['Essencial', 'Supérfluo', 'Recorrente', 'Trabalho', 'Pessoal', 'Parcelado'];

const cardGradients = {
  purple: 'from-purple-600 to-indigo-800',
  sky: 'from-sky-500 to-blue-700',
  slate: 'from-slate-700 to-slate-900',
  emerald: 'from-emerald-600 to-teal-800',
};
const cardColorOrder = ['purple', 'sky', 'emerald', 'slate'];

let _id = Date.now();
const nid = () => `tx-${_id++}`;
const ngroup = () => `grp-${_id++}`;

const mkTx = (o) => ({ confirmed: true, groupId: null, installmentIndex: null, installmentTotal: null, recurrence: null, ...o, id: nid() });

const STORAGE_KEY = 'edvice-data';
const RECUR_HORIZON = { monthly: 24, yearly: 6 };

const TABS = [
  { id: 'dashboard', label: 'Início', icon: Home },
  { id: 'transactions', label: 'Transações', icon: Receipt },
  { id: 'categories', label: 'Categorias', icon: FolderOpen },
  { id: 'cards', label: 'Cartões', icon: CreditCard },
  { id: 'reports', label: 'Relatórios', icon: PieIcon },
];

/* ----------------------------- small UI pieces ----------------------------- */
function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-500 mb-1 block">{label}</label>
      {children}
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-slate-300">
      <Receipt size={36} />
      <p className="text-sm mt-2 text-center px-6">{text}</p>
    </div>
  );
}

function Row({ label, value, color }) {
  const colorClass = color === 'rose' ? 'text-rose-600' : color === 'emerald' ? 'text-emerald-600' : 'text-slate-700';
  return (
    <div className="flex justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={`font-semibold ${colorClass}`}>{value}</span>
    </div>
  );
}

/* ----------------------------- header / nav ----------------------------- */
function Header({ onAdd }) {
  return (
    <header className="px-4 pt-4 pb-2 flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center">
          <Wallet size={18} className="text-white" />
        </div>
        <h1 className="text-lg font-bold text-slate-800">Edvice</h1>
        <span className="text-[10px] font-medium text-slate-400 mt-1">v0.1</span>
      </div>
      <button
        onClick={onAdd}
        className="w-9 h-9 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow active:scale-95 transition"
        aria-label="Nova transação"
      >
        <Plus size={20} />
      </button>
    </header>
  );
}

function MonthNav({ viewDate, onChange }) {
  const go = (delta) => onChange(new Date(viewDate.getFullYear(), viewDate.getMonth() + delta, 1));
  return (
    <div className="px-4 pb-2 flex items-center justify-between flex-shrink-0">
      <button onClick={() => go(-1)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400" aria-label="Mês anterior">
        <ChevronLeft size={18} />
      </button>
      <span className="text-sm font-semibold text-slate-700">
        {monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}
      </span>
      <button onClick={() => go(1)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400" aria-label="Próximo mês">
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

function BottomNav({ active, onChange }) {
  return (
    <nav className="grid grid-cols-5 border-t border-slate-200 bg-white flex-shrink-0">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}
          >
            <Icon size={20} />
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}

/* ----------------------------- category card (shared) ----------------------------- */
function CategoryCard({ cat, isExpense, onClick }) {
  const hasBudget = isExpense && cat.budget > 0;
  const pct = hasBudget ? (cat.spent / cat.budget) * 100 : 0;
  const over = hasBudget && cat.spent > cat.budget;
  return (
    <button onClick={onClick} className="w-full text-left bg-white border border-slate-200 rounded-xl p-3 active:border-indigo-300 transition">
      <div className="flex justify-between items-center mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
          <span className="text-sm font-medium text-slate-700 truncate">{cat.name}</span>
          {over && <AlertTriangle size={14} className="text-rose-500 flex-shrink-0" />}
        </div>
        <span className={`text-xs font-semibold flex-shrink-0 ml-2 ${over ? 'text-rose-600' : 'text-slate-500'}`}>
          {hasBudget ? `${fmt(cat.spent)} / ${fmt(cat.budget)}` : fmt(cat.spent)}
        </span>
      </div>
      {hasBudget && (
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${over ? 'bg-rose-500' : 'bg-indigo-500'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
      )}
    </button>
  );
}

/* ----------------------------- dashboard ----------------------------- */
function Dashboard({ income, expense, categorySpending, onSelectCategory }) {
  const balance = income - expense;
  return (
    <div className="space-y-4 pt-1">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl p-4 bg-emerald-50">
          <div className="flex items-center gap-2 mb-1 text-emerald-700">
            <TrendingUp size={16} />
            <span className="text-xs font-medium">Receitas</span>
          </div>
          <p className="text-lg font-bold text-emerald-700">{fmt(income)}</p>
        </div>
        <div className="rounded-2xl p-4 bg-rose-50">
          <div className="flex items-center gap-2 mb-1 text-rose-700">
            <TrendingDown size={16} />
            <span className="text-xs font-medium">Despesas</span>
          </div>
          <p className="text-lg font-bold text-rose-700">{fmt(expense)}</p>
        </div>
      </div>
      <div className={`rounded-2xl p-4 ${balance >= 0 ? 'bg-indigo-600' : 'bg-rose-600'} text-white`}>
        <p className="text-xs opacity-80">Saldo do mês</p>
        <p className="text-2xl font-bold">{fmt(balance)}</p>
      </div>
      <div>
        <h2 className="text-sm font-semibold text-slate-600 mb-2">Orçamentos por categoria</h2>
        <div className="space-y-2">
          {categorySpending.map((cat) => (
            <CategoryCard key={cat.id} cat={cat} isExpense onClick={() => onSelectCategory(cat.id)} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- transactions ----------------------------- */
function TransactionRow({ tx, categories, onToggleConfirm, onEdit, onDelete }) {
  const cat = categories.find((c) => c.id === tx.category);
  const isIncome = tx.type === 'income';
  const isFuture = tx.date > todayISO;
  const isOff = isFuture && tx.confirmed === false;
  const color = cat?.color || '#94a3b8';

  return (
    <div className={`flex items-start gap-3 bg-white border border-slate-200 rounded-xl p-3 ${isOff ? 'opacity-60' : ''}`}>
      <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: `${color}22` }}>
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${isOff ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{tx.description}</p>
        <div className="flex items-center gap-1.5 text-xs text-slate-400 flex-wrap mt-0.5">
          <span>{fmtDate(tx.date)}</span>
          <span>·</span>
          <span className="truncate">{cat?.name}</span>
          {tx.groupId && (
            tx.recurrence ? (
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-violet-50 text-violet-500">
                <Repeat size={10} /> {tx.recurrence === 'monthly' ? 'Mensal' : 'Anual'}
              </span>
            ) : (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-indigo-50 text-indigo-500">
                {tx.installmentIndex}/{tx.installmentTotal}
              </span>
            )
          )}
          {isFuture ? (
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={tx.confirmed !== false}
                onChange={() => onToggleConfirm(tx.id)}
                className="w-3 h-3 rounded border-slate-300 accent-indigo-600"
              />
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${tx.confirmed !== false ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>
                {tx.confirmed !== false ? 'Planejado' : 'Não vai ocorrer'}
              </span>
            </label>
          ) : (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500">Realizado</span>
          )}
        </div>
        {tx.tags?.length > 0 && (
          <div className="flex gap-1 mt-1 flex-wrap">
            {tx.tags.map((t) => (
              <span key={t} className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-full">{t}</span>
            ))}
          </div>
        )}
      </div>
      <div className="text-right flex-shrink-0 flex flex-col items-end gap-1.5">
        <p className={`text-sm font-semibold ${isOff ? 'text-slate-400 line-through' : (isIncome ? 'text-emerald-600' : 'text-slate-800')}`}>
          {isIncome ? '+ ' : '- '}{fmt(tx.value)}
        </p>
        <div className="flex gap-2">
          <button onClick={() => onEdit(tx)} className="text-slate-300 active:text-indigo-500" aria-label="Editar">
            <Pencil size={14} />
          </button>
          <button onClick={() => onDelete(tx)} className="text-slate-300 active:text-rose-500" aria-label="Excluir">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function Transactions({ items, categories, onToggleConfirm, onEdit, onDelete }) {
  if (items.length === 0) return <EmptyState text="Nenhuma transação neste mês. Toque em + para adicionar." />;
  const sorted = [...items].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="space-y-2 pt-1 pb-1">
      {sorted.map((tx) => (
        <TransactionRow key={tx.id} tx={tx} categories={categories} onToggleConfirm={onToggleConfirm} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  );
}

/* ----------------------------- categories ----------------------------- */
function Categories({ expenseCats, incomeCats, allCats, selected, onSelect, onBack, monthTx, onToggleConfirm, onEdit, onDelete }) {
  if (selected) {
    const isExpense = expenseCats.some((c) => c.id === selected);
    const catData = (isExpense ? expenseCats : incomeCats).find((c) => c.id === selected);
    const txs = monthTx.filter((t) => t.category === selected).sort((a, b) => b.date.localeCompare(a.date));
    const hasBudget = isExpense && catData.budget > 0;
    const remaining = catData.budget - catData.spent;
    return (
      <div className="space-y-3 pt-1">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-indigo-600 font-medium">
          <ArrowLeft size={16} /> Categorias
        </button>
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: catData.color }} />
            <h2 className="font-bold text-slate-800">{catData.name}</h2>
          </div>
          {hasBudget ? (
            <div className="space-y-2">
              <Row label="Orçado" value={fmt(catData.budget)} />
              <Row label="Gasto" value={fmt(catData.spent)} color={catData.spent > catData.budget ? 'rose' : null} />
              <Row label="Restante" value={fmt(remaining)} color={remaining < 0 ? 'rose' : 'emerald'} />
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden mt-1">
                <div className={`h-full rounded-full ${catData.spent > catData.budget ? 'bg-rose-500' : 'bg-indigo-500'}`} style={{ width: `${Math.min((catData.spent / catData.budget) * 100, 100)}%` }} />
              </div>
            </div>
          ) : (
            <Row label={isExpense ? 'Gasto no mês' : 'Recebido no mês'} value={fmt(catData.spent)} />
          )}
        </div>
        <h3 className="text-sm font-semibold text-slate-600 pt-1">Transações ({txs.length})</h3>
        {txs.length === 0 ? <EmptyState text="Nenhuma transação nessa categoria neste mês." /> : (
          <div className="space-y-2 pb-1">
            {txs.map((tx) => (
              <TransactionRow key={tx.id} tx={tx} categories={allCats} onToggleConfirm={onToggleConfirm} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-1 pb-1">
      <div>
        <h2 className="text-sm font-semibold text-slate-600 mb-2">Categorias de gastos</h2>
        <div className="space-y-2">
          {expenseCats.map((c) => <CategoryCard key={c.id} cat={c} isExpense onClick={() => onSelect(c.id)} />)}
        </div>
      </div>
      <div>
        <h2 className="text-sm font-semibold text-slate-600 mb-2">Categorias de renda</h2>
        <div className="space-y-2">
          {incomeCats.map((c) => <CategoryCard key={c.id} cat={c} isExpense={false} onClick={() => onSelect(c.id)} />)}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- cards ----------------------------- */
function CardsTab({ cards, getInvoice, onAddCard }) {
  return (
    <div className="space-y-3 pt-1 pb-1">
      {cards.map((card) => {
        const inv = getInvoice(card);
        const usagePct = card.limit > 0 ? (inv.total / card.limit) * 100 : 0;
        const gradient = cardGradients[card.color] || cardGradients.slate;
        return (
          <div key={card.id} className={`bg-gradient-to-br ${gradient} text-white rounded-2xl p-4 space-y-3 shadow-sm`}>
            <div className="flex justify-between items-start">
              <div>
                <p className="font-bold">{card.name}</p>
                <p className="text-xs text-white/70">Limite {fmt(card.limit)}</p>
              </div>
              <CreditCard size={22} className="text-white/60" />
            </div>
            <div>
              <p className="text-xs text-white/70">Fatura do período</p>
              <p className="text-xl font-bold">{fmt(inv.total)}</p>
              <p className="text-xs text-white/60">
                Período {fmtDate(toISO(inv.start))} – {fmtDate(toISO(inv.end))} · Vencimento {fmtDate(toISO(inv.due))}
              </p>
            </div>
            <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white/80 rounded-full" style={{ width: `${Math.min(usagePct, 100)}%` }} />
            </div>
            <div className="flex justify-between text-[11px] text-white/60">
              <span>Fecha dia {card.closingDay}</span>
              <span>Vence dia {card.dueDay}</span>
            </div>
          </div>
        );
      })}
      <button onClick={onAddCard} className="w-full border-2 border-dashed border-slate-200 rounded-2xl p-4 text-sm text-slate-400 font-medium flex items-center justify-center gap-2 active:bg-slate-50">
        <Plus size={16} /> Adicionar cartão
      </button>
      <p className="text-xs text-slate-400 text-center px-4">
        Compras no crédito entram automaticamente na fatura do cartão escolhido, de acordo com o dia de fechamento. Lançamentos marcados como "não vai ocorrer" não entram na fatura.
      </p>
    </div>
  );
}

/* ----------------------------- reports ----------------------------- */
function Reports({ categorySpending, income, expense }) {
  const pieData = categorySpending.filter((c) => c.spent > 0).map((c) => ({ name: c.name, value: c.spent, color: c.color }));
  const barData = categorySpending.map((c) => ({ name: c.name.length > 5 ? `${c.name.slice(0, 4)}.` : c.name, Orçado: c.budget, Gasto: c.spent }));

  return (
    <div className="space-y-5 pt-1 pb-2">
      <div>
        <h2 className="text-sm font-semibold text-slate-600 mb-2">Despesas por categoria</h2>
        {pieData.length === 0 ? <EmptyState text="Sem despesas confirmadas neste mês ainda." /> : (
          <div className="bg-white border border-slate-200 rounded-2xl p-2" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2}>
                  {pieData.map((entry, i) => <Cell key={`cell-${i}`} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(v) => fmt(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
      <div>
        <h2 className="text-sm font-semibold text-slate-600 mb-2">Orçado vs. gasto por categoria</h2>
        <div className="bg-white border border-slate-200 rounded-2xl p-2" style={{ height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => fmt(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Orçado" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Gasto" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div>
        <h2 className="text-sm font-semibold text-slate-600 mb-2">Resumo do mês</h2>
        <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 text-sm">
          <div className="flex justify-between p-3"><span className="text-slate-500">Receitas</span><span className="font-semibold text-emerald-600">{fmt(income)}</span></div>
          <div className="flex justify-between p-3"><span className="text-slate-500">Despesas</span><span className="font-semibold text-rose-600">{fmt(expense)}</span></div>
          <div className="flex justify-between p-3"><span className="text-slate-500">Saldo</span><span className="font-semibold text-slate-700">{fmt(income - expense)}</span></div>
        </div>
        <p className="text-xs text-slate-400 px-1 pt-2">Considera só transações confirmadas (planejadas que você ainda não desmarcou).</p>
      </div>
    </div>
  );
}

/* ----------------------------- transaction form (criar / editar) ----------------------------- */
function TransactionForm({ onClose, onSubmit, expenseCats, incomeCats, cards, tags, onAddTag, editingTx }) {
  const isEdit = !!editingTx;
  const initialDesc = editingTx ? (editingTx.groupId ? stripInstallmentSuffix(editingTx.description) : editingTx.description) : '';

  const [type, setType] = useState(editingTx?.type || 'expense');
  const [date, setDate] = useState(editingTx?.date || todayISO);
  const [description, setDescription] = useState(initialDesc);
  const [value, setValue] = useState(editingTx ? String(editingTx.value) : '');
  const [category, setCategory] = useState(editingTx?.category || expenseCats[0]?.id || '');
  const [selectedTags, setSelectedTags] = useState(editingTx?.tags || []);
  const [newTag, setNewTag] = useState('');
  const [method, setMethod] = useState(editingTx?.method || 'pix');
  const [cardId, setCardId] = useState(editingTx?.cardId || cards[0]?.id || '');
  const [repeatMode, setRepeatMode] = useState('none'); // 'none' | 'installment' | 'recurring'
  const [installmentCount, setInstallmentCount] = useState(2);
  const [valueMode, setValueMode] = useState('parcela');
  const [recurrence, setRecurrence] = useState('monthly');

  const cats = type === 'expense' ? expenseCats : incomeCats;
  const status = date <= todayISO ? 'Realizado' : 'Planejado';

  const changeType = (t) => {
    setType(t);
    const list = t === 'expense' ? expenseCats : incomeCats;
    setCategory(list[0]?.id || '');
    if (t === 'income') {
      if (method === 'credito') setMethod('pix');
      if (repeatMode === 'installment') setRepeatMode('none');
    }
  };

  const toggleTag = (t) => setSelectedTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const addNewTag = () => {
    const tag = newTag.trim();
    if (!tag || tags.includes(tag)) return;
    onAddTag(tag);
    setSelectedTags((prev) => [...prev, tag]);
    setNewTag('');
  };

  const canSubmit = description.trim().length > 0 && Number(value) > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({
      type,
      date,
      description: description.trim(),
      value: Number(value),
      category,
      tags: selectedTags,
      method,
      cardId: type === 'expense' && method === 'credito' ? cardId : null,
      installments: !isEdit && repeatMode === 'installment' ? Number(installmentCount) : null,
      valueMode,
      repeatMode: !isEdit ? repeatMode : 'none',
      recurrence: !isEdit && repeatMode === 'recurring' ? recurrence : null,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50">
      <div className="bg-white w-full max-w-md rounded-t-3xl p-4 max-h-[88vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-slate-800">{isEdit ? 'Editar transação' : 'Nova transação'}</h2>
          <button onClick={onClose} aria-label="Fechar"><X size={20} className="text-slate-400" /></button>
        </div>

        {isEdit && editingTx.groupId && (
          <p className="text-xs text-indigo-600 bg-indigo-50 rounded-lg p-2 mb-3">
            {editingTx.recurrence
              ? `Lançamento recorrente (${editingTx.recurrence === 'monthly' ? 'mensal' : 'anual'}). Ao salvar, você escolhe se a alteração vale só para este, para todos, ou para este e os seguintes.`
              : `Parcela ${editingTx.installmentIndex}/${editingTx.installmentTotal}. Ao salvar, você escolhe se a alteração vale só para esta parcela, para todas, ou para esta e as futuras.`}
          </p>
        )}

        <div className="grid grid-cols-2 gap-2 mb-4">
          <button onClick={() => changeType('expense')} className={`py-2 rounded-xl text-sm font-semibold transition ${type === 'expense' ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-500'}`}>Gasto</button>
          <button onClick={() => changeType('income')} className={`py-2 rounded-xl text-sm font-semibold transition ${type === 'income' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>Renda</button>
        </div>

        <div className="space-y-3">
          <Field label="Descrição">
            <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} placeholder="Ex: Supermercado" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={!isEdit && repeatMode === 'installment' && valueMode === 'total' ? 'Valor total da compra (R$)' : 'Valor (R$)'}>
              <input type="number" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} className={inputClass} placeholder="0,00" />
            </Field>
            <Field label="Data">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
            </Field>
          </div>
          <p className="text-xs text-slate-400 -mt-1">
            Status: <span className={status === 'Realizado' ? 'text-slate-600 font-medium' : 'text-amber-600 font-medium'}>{status}</span>
          </p>

          <Field label="Categoria">
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>

          <Field label="Forma">
            <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputClass}>
              <option value="pix">Pix</option>
              <option value="debito">Débito</option>
              {type === 'expense' && <option value="credito">Cartão de crédito</option>}
              <option value="dinheiro">Dinheiro</option>
            </select>
          </Field>

          {type === 'expense' && method === 'credito' && (
            <Field label="Cartão">
              <select value={cardId} onChange={(e) => setCardId(e.target.value)} className={inputClass}>
                {cards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
          )}

          {!isEdit && (
            <div className="space-y-2">
              <Field label="Repetição">
                <div className={`grid gap-2 ${type === 'expense' ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  <button type="button" onClick={() => setRepeatMode('none')} className={`py-2 rounded-xl text-xs font-semibold transition ${repeatMode === 'none' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>Nenhuma</button>
                  {type === 'expense' && (
                    <button type="button" onClick={() => setRepeatMode('installment')} className={`py-2 rounded-xl text-xs font-semibold transition ${repeatMode === 'installment' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>Parcelado</button>
                  )}
                  <button type="button" onClick={() => setRepeatMode('recurring')} className={`py-2 rounded-xl text-xs font-semibold transition ${repeatMode === 'recurring' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>Recorrente</button>
                </div>
              </Field>

              {repeatMode === 'installment' && (
                <div className="space-y-2 pl-1">
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setValueMode('parcela')} className={`py-1.5 rounded-lg text-xs font-medium transition ${valueMode === 'parcela' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      Valor por parcela
                    </button>
                    <button type="button" onClick={() => setValueMode('total')} className={`py-1.5 rounded-lg text-xs font-medium transition ${valueMode === 'total' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      Valor total
                    </button>
                  </div>
                  <Field label="Número de parcelas">
                    <input type="number" min="2" max="48" value={installmentCount} onChange={(e) => setInstallmentCount(e.target.value)} className={inputClass} />
                  </Field>
                  {valueMode === 'total' && Number(value) > 0 && Number(installmentCount) > 0 && (
                    <p className="text-xs text-slate-400">≈ {fmt(Number(value) / Number(installmentCount))} por parcela</p>
                  )}
                </div>
              )}

              {repeatMode === 'recurring' && (
                <div className="space-y-2 pl-1">
                  <Field label="Frequência">
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => setRecurrence('monthly')} className={`py-1.5 rounded-lg text-xs font-medium transition ${recurrence === 'monthly' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>Mensal</button>
                      <button type="button" onClick={() => setRecurrence('yearly')} className={`py-1.5 rounded-lg text-xs font-medium transition ${recurrence === 'yearly' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>Anual</button>
                    </div>
                  </Field>
                  <p className="text-xs text-slate-400">
                    {recurrence === 'monthly' ? 'Cria um lançamento todo mês a partir desta data.' : 'Cria um lançamento todo ano a partir desta data.'}
                  </p>
                </div>
              )}
            </div>
          )}

          <Field label="Tags">
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map((t) => (
                <button key={t} onClick={() => toggleTag(t)} className={`text-xs px-2.5 py-1 rounded-full border transition ${selectedTags.includes(t) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'}`}>
                  {t}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="Nova tag" className={inputClass} onKeyDown={(e) => { if (e.key === 'Enter') addNewTag(); }} />
              <button onClick={addNewTag} className="px-3 bg-slate-100 rounded-lg text-sm font-medium text-slate-500">+</button>
            </div>
          </Field>
        </div>

        <button onClick={handleSubmit} disabled={!canSubmit} className="w-full mt-4 bg-indigo-600 text-white font-semibold py-3 rounded-xl disabled:opacity-40">
          {isEdit ? 'Salvar alterações' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}

/* ----------------------------- card form ----------------------------- */
function CardForm({ onClose, onSubmit }) {
  const [name, setName] = useState('');
  const [limit, setLimit] = useState('');
  const [closingDay, setClosingDay] = useState('1');
  const [dueDay, setDueDay] = useState('10');

  const canSubmit = name.trim().length > 0 && Number(limit) > 0;

  const submit = () => {
    if (!canSubmit) return;
    onSubmit({
      id: `card-${Date.now()}`,
      name: name.trim(),
      limit: Number(limit),
      closingDay: Math.min(Math.max(Number(closingDay), 1), 31),
      dueDay: Math.min(Math.max(Number(dueDay), 1), 31),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50">
      <div className="bg-white w-full max-w-md rounded-t-3xl p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-slate-800">Novo cartão</h2>
          <button onClick={onClose} aria-label="Fechar"><X size={20} className="text-slate-400" /></button>
        </div>
        <div className="space-y-3">
          <Field label="Nome"><input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Ex: Inter" /></Field>
          <Field label="Limite (R$)"><input type="number" inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} className={inputClass} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Dia de fechamento"><input type="number" min="1" max="31" value={closingDay} onChange={(e) => setClosingDay(e.target.value)} className={inputClass} /></Field>
            <Field label="Dia de vencimento"><input type="number" min="1" max="31" value={dueDay} onChange={(e) => setDueDay(e.target.value)} className={inputClass} /></Field>
          </div>
        </div>
        <button onClick={submit} disabled={!canSubmit} className="w-full mt-4 bg-indigo-600 text-white font-semibold py-3 rounded-xl disabled:opacity-40">
          Adicionar
        </button>
      </div>
    </div>
  );
}

/* ----------------------------- confirmação de exclusão de parcela ----------------------------- */
function ConfirmDeleteModal({ tx, onCancel, onConfirm }) {
  const baseDesc = stripInstallmentSuffix(tx.description);
  const isRecurring = !!tx.recurrence;
  const freqLabel = tx.recurrence === 'monthly' ? 'mensal' : 'anual';
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-6">
      <div className="bg-white w-full max-w-sm rounded-2xl p-4 space-y-3">
        <h3 className="font-bold text-slate-800">Excluir</h3>
        <p className="text-sm text-slate-500">
          "{baseDesc}" {isRecurring ? `é um lançamento recorrente (${freqLabel})` : `faz parte de uma compra parcelada (${tx.installmentIndex}/${tx.installmentTotal})`}. O que você quer excluir?
        </p>
        <div className="space-y-2 pt-1">
          <button onClick={() => onConfirm('one')} className="w-full text-sm font-medium py-2.5 rounded-xl bg-slate-100 text-slate-700">Só esta</button>
          <button onClick={() => onConfirm('future')} className="w-full text-sm font-medium py-2.5 rounded-xl bg-rose-50 text-rose-600">Esta e as futuras</button>
          <button onClick={onCancel} className="w-full text-sm font-medium py-2 text-slate-400">Cancelar</button>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- escolha de abrangência ao editar ----------------------------- */
function EditScopeModal({ pending, onCancel, onConfirm }) {
  const { target } = pending;
  const baseDesc = stripInstallmentSuffix(target.description);
  const isRecurring = !!target.recurrence;
  const freqLabel = target.recurrence === 'monthly' ? 'mensal' : 'anual';
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-6">
      <div className="bg-white w-full max-w-sm rounded-2xl p-4 space-y-3">
        <h3 className="font-bold text-slate-800">Aplicar alteração</h3>
        <p className="text-sm text-slate-500">
          "{baseDesc}" {isRecurring ? `é um lançamento recorrente (${freqLabel})` : `faz parte de uma compra parcelada (${target.installmentIndex}/${target.installmentTotal})`}. Onde aplicar essa alteração?
        </p>
        <div className="space-y-2 pt-1">
          <button onClick={() => onConfirm('one')} className="w-full text-sm font-medium py-2.5 rounded-xl bg-slate-100 text-slate-700">Só esta</button>
          <button onClick={() => onConfirm('future')} className="w-full text-sm font-medium py-2.5 rounded-xl bg-indigo-50 text-indigo-600">Esta e as futuras</button>
          <button onClick={() => onConfirm('all')} className="w-full text-sm font-medium py-2.5 rounded-xl bg-slate-100 text-slate-700">Todas</button>
          <button onClick={onCancel} className="w-full text-sm font-medium py-2 text-slate-400">Cancelar</button>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- main app ----------------------------- */
export default function EdviceApp() {
  const [loaded, setLoaded] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [expenseCats] = useState(initialExpenseCategories);
  const [incomeCats] = useState(initialIncomeCategories);
  const [cards, setCards] = useState([]);
  const [tags, setTags] = useState(initialTags);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [formTarget, setFormTarget] = useState(null); // null | 'new' | <transação sendo editada>
  const [showCardForm, setShowCardForm] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [deletingTx, setDeletingTx] = useState(null);
  const [pendingEdit, setPendingEdit] = useState(null); // { target, data } aguardando escolha de abrangência

  // Carrega os dados salvos (uma vez, ao abrir o app).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (Array.isArray(data.transactions)) setTransactions(data.transactions);
        if (Array.isArray(data.cards)) setCards(data.cards);
        if (Array.isArray(data.tags)) setTags(data.tags);
      }
    } catch (e) {
      // primeira vez usando o app (ou storage indisponível) — começa do zero
    } finally {
      setLoaded(true);
    }
  }, []);

  // Salva sempre que algo relevante mudar (depois do carregamento inicial).
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ transactions, cards, tags }));
    } catch (e) {
      // ignora falha de storage (ex: modo privado / quota cheia)
    }
  }, [transactions, cards, tags, loaded]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const monthTx = transactions.filter((t) => {
    const d = parseISO(t.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  // Só entram nos totais/relatórios as transações confirmadas
  // (realizadas contam sempre; planejadas contam até serem desmarcadas).
  const countedTx = monthTx.filter((t) => t.confirmed !== false);

  const income = countedTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.value, 0);
  const expense = countedTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.value, 0);

  const categorySpending = expenseCats.map((c) => ({
    ...c,
    spent: countedTx.filter((t) => t.type === 'expense' && t.category === c.id).reduce((s, t) => s + t.value, 0),
  }));

  const incomeCatTotals = incomeCats.map((c) => ({
    ...c,
    spent: countedTx.filter((t) => t.type === 'income' && t.category === c.id).reduce((s, t) => s + t.value, 0),
  }));

  const allCats = [...expenseCats, ...incomeCats];

  // Calcula a fatura do cartão cujo vencimento cai no mês visualizado,
  // com base nos dias de fechamento e vencimento cadastrados.
  const getInvoice = (card) => {
    const due = new Date(year, month, card.dueDay);
    let end;
    if (card.dueDay > card.closingDay) {
      end = new Date(year, month, card.closingDay);
    } else {
      end = new Date(year, month - 1, card.closingDay);
    }
    const start = new Date(end.getFullYear(), end.getMonth() - 1, card.closingDay + 1);

    const items = transactions.filter((t) => {
      if (t.method !== 'credito' || t.cardId !== card.id || t.confirmed === false) return false;
      const d = parseISO(t.date).getTime();
      return d > start.getTime() && d <= end.getTime();
    });
    const total = items.reduce((s, t) => s + t.value, 0);
    return { total, items, start, end, due };
  };

  const addTransaction = (data) => {
    const { installments, valueMode, repeatMode, recurrence, ...rest } = data;
    if (repeatMode === 'installment' && installments > 1) {
      const groupId = ngroup();
      const perValue = valueMode === 'total' ? Math.round((rest.value / installments) * 100) / 100 : rest.value;
      const base = parseISO(rest.date);
      const items = Array.from({ length: installments }, (_, i) => {
        const d = addMonthsClamped(base, i);
        return {
          id: nid(),
          ...rest,
          tags: [...rest.tags],
          value: perValue,
          date: toISO(d),
          description: `${rest.description} (${i + 1}/${installments})`,
          confirmed: true,
          groupId,
          installmentIndex: i + 1,
          installmentTotal: installments,
          recurrence: null,
        };
      });
      setTransactions((prev) => [...prev, ...items]);
    } else if (repeatMode === 'recurring') {
      const groupId = ngroup();
      const horizon = RECUR_HORIZON[recurrence] || RECUR_HORIZON.monthly;
      const base = parseISO(rest.date);
      const items = Array.from({ length: horizon }, (_, i) => {
        const d = addMonthsClamped(base, recurrence === 'yearly' ? i * 12 : i);
        return {
          id: nid(),
          ...rest,
          tags: [...rest.tags],
          date: toISO(d),
          confirmed: true,
          groupId,
          installmentIndex: i + 1,
          installmentTotal: horizon,
          recurrence,
        };
      });
      setTransactions((prev) => [...prev, ...items]);
    } else {
      setTransactions((prev) => [...prev, mkTx(rest)]);
    }
  };

  // scope: 'one' (só esta), 'future' (esta e as futuras) ou 'all' (todas) — só importa quando target.groupId existe.
  const updateTransaction = (target, data, scope) => {
    const { installments, valueMode, repeatMode, recurrence, ...rest } = data;
    const applyShared = (t) => ({
      ...t,
      type: rest.type,
      description: seriesDescription(t, rest.description),
      value: rest.value,
      category: rest.category,
      tags: [...rest.tags],
      method: rest.method,
      cardId: rest.cardId,
      date: t.id === target.id ? rest.date : t.date,
    });

    setTransactions((prev) => prev.map((t) => {
      if (t.id === target.id) return applyShared(t);
      if (!target.groupId || t.groupId !== target.groupId) return t;
      if (scope === 'all') return applyShared(t);
      if (scope === 'future' && t.installmentIndex >= target.installmentIndex) return applyShared(t);
      return t;
    }));
  };

  const toggleConfirmed = (id) => {
    setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, confirmed: t.confirmed === false ? true : false } : t)));
  };

  const requestDelete = (tx) => {
    if (tx.groupId) {
      const siblings = transactions.filter((t) => t.groupId === tx.groupId);
      if (siblings.length > 1) {
        setDeletingTx(tx);
        return;
      }
    }
    setTransactions((prev) => prev.filter((t) => t.id !== tx.id));
  };

  const confirmDelete = (scope) => {
    if (!deletingTx) return;
    if (scope === 'one') {
      setTransactions((prev) => prev.filter((t) => t.id !== deletingTx.id));
    } else {
      setTransactions((prev) => prev.filter((t) => !(t.groupId === deletingTx.groupId && t.installmentIndex >= deletingTx.installmentIndex)));
    }
    setDeletingTx(null);
  };

  const addTag = (t) => setTags((prev) => [...prev, t]);
  const addCard = (c) => setCards((prev) => [...prev, { ...c, color: cardColorOrder[prev.length % cardColorOrder.length] }]);

  const changeTab = (tab) => { setActiveTab(tab); setSelectedCategory(null); };

  const showMonthNav = !(activeTab === 'categories' && selectedCategory);

  const editingTx = formTarget && formTarget !== 'new' ? formTarget : null;

  const handleFormSubmit = (data) => {
    if (editingTx) {
      if (editingTx.groupId) {
        setPendingEdit({ target: editingTx, data });
      } else {
        updateTransaction(editingTx, data, 'one');
      }
    } else {
      addTransaction(data);
    }
  };

  const applyEditScope = (scope) => {
    if (!pendingEdit) return;
    updateTransaction(pendingEdit.target, pendingEdit.data, scope);
    setPendingEdit(null);
  };

  if (!loaded) {
    return (
      <div className="max-w-md mx-auto h-screen flex items-center justify-center bg-slate-50 font-sans">
        <p className="text-sm text-slate-400">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto h-screen flex flex-col bg-slate-50 font-sans">
      <Header onAdd={() => setFormTarget('new')} />
      {showMonthNav && <MonthNav viewDate={viewDate} onChange={setViewDate} />}

      <main className="flex-1 overflow-y-auto px-4">
        {activeTab === 'dashboard' && (
          <Dashboard
            income={income}
            expense={expense}
            categorySpending={categorySpending}
            onSelectCategory={(id) => { setSelectedCategory(id); setActiveTab('categories'); }}
          />
        )}
        {activeTab === 'transactions' && (
          <Transactions items={monthTx} categories={allCats} onToggleConfirm={toggleConfirmed} onEdit={setFormTarget} onDelete={requestDelete} />
        )}
        {activeTab === 'categories' && (
          <Categories
            expenseCats={categorySpending}
            incomeCats={incomeCatTotals}
            allCats={allCats}
            selected={selectedCategory}
            onSelect={setSelectedCategory}
            onBack={() => setSelectedCategory(null)}
            monthTx={monthTx}
            onToggleConfirm={toggleConfirmed}
            onEdit={setFormTarget}
            onDelete={requestDelete}
          />
        )}
        {activeTab === 'cards' && (
          <CardsTab cards={cards} getInvoice={getInvoice} onAddCard={() => setShowCardForm(true)} />
        )}
        {activeTab === 'reports' && (
          <Reports categorySpending={categorySpending} income={income} expense={expense} />
        )}
      </main>

      <BottomNav active={activeTab} onChange={changeTab} />

      {formTarget && (
        <TransactionForm
          onClose={() => setFormTarget(null)}
          onSubmit={handleFormSubmit}
          expenseCats={expenseCats}
          incomeCats={incomeCats}
          cards={cards}
          tags={tags}
          onAddTag={addTag}
          editingTx={editingTx}
        />
      )}
      {showCardForm && <CardForm onClose={() => setShowCardForm(false)} onSubmit={addCard} />}
      {deletingTx && <ConfirmDeleteModal tx={deletingTx} onCancel={() => setDeletingTx(null)} onConfirm={confirmDelete} />}
      {pendingEdit && <EditScopeModal pending={pendingEdit} onCancel={() => setPendingEdit(null)} onConfirm={applyEditScope} />}
    </div>
  );
}
