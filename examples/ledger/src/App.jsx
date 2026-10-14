import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
const initial = [
  {
    id: 1,
    name: "午后的一杯咖啡",
    category: "餐饮美食",
    amount: -28,
    date: "今天 14:30",
    emoji: "☕",
  },
  {
    id: 2,
    name: "日常采购",
    category: "购物消费",
    amount: -186.5,
    date: "今天 10:15",
    emoji: "🛍",
  },
  {
    id: 3,
    name: "项目收入",
    category: "工作收入",
    amount: 3200,
    date: "昨天 16:00",
    emoji: "↗",
  },
  {
    id: 4,
    name: "地铁出行",
    category: "交通出行",
    amount: -12,
    date: "昨天 08:40",
    emoji: "🚇",
  },
];
const storageKey = `ledger-demo:${location.pathname}`;
function App() {
  const [items, setItems] = useState(() => {
      try {
        return (
          JSON.parse(localStorage.getItem(storageKey) || "null") || initial
        );
      } catch {
        return initial;
      }
    }),
    [open, setOpen] = useState(false),
    [filter, setFilter] = useState("全部");
  const expense = items
      .filter((i) => i.amount < 0)
      .reduce((s, i) => s - i.amount, 0),
    income = items
      .filter((i) => i.amount > 0)
      .reduce((s, i) => s + i.amount, 0);
  const categories = ["购物消费", "餐饮美食", "交通出行"];
  const colors = ["#88a186", "#c3cfad", "#e4dec8"];
  let stop = 0;
  const segments = categories.map((category, index) => {
    const amount = -items
      .filter((i) => i.category === category && i.amount < 0)
      .reduce((total, i) => total + i.amount, 0);
    const start = stop;
    stop += expense ? (amount / expense) * 100 : 0;
    return `${colors[index]} ${start}% ${stop}%`;
  });
  const format = (n) =>
    n.toLocaleString("zh-CN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  return (
    <main>
      <header>
        <a className="logo" href="#">
          <span>◒</span>小账本<small>让生活，有迹可循</small>
        </a>
        <span className="demo-badge">开发示例 · 数据仅供体验</span>
      </header>
      <section
        className="greeting"
        data-ai-id="greeting"
        data-ai-source="src/App.jsx"
      >
        <div>
          <p className="eyebrow">YOUR EVERYDAY, IN BALANCE</p>
          <h1>每一笔，都好好记录。</h1>
          <p>看看这个月，生活的小小收支。</p>
        </div>
        <button
          className="primary"
          onClick={() => setOpen(true)}
          data-ai-id="add-transaction"
        >
          ＋ 记一笔
        </button>
      </section>
      <section
        className="summary"
        data-ai-id="monthly-summary"
        data-ai-source="src/App.jsx"
      >
        <article className="balance">
          <p>
            本月结余 <span>↗</span>
          </p>
          <h2>¥ {format(income - expense)}</h2>
          <small>收入与支出的差额</small>
          <div className="curve" aria-hidden="true">
            <svg viewBox="0 0 260 60">
              <path d="M0 48 Q30 60 48 30 T96 32 T150 12 T210 20 T260 3" />
            </svg>
          </div>
        </article>
        <article data-ai-id="income-card">
          <p>
            本月收入 <span className="green">↙</span>
          </p>
          <h2>¥ {format(income)}</h2>
          <small>
            <i className="dot green-bg" />{" "}
            {items.filter((i) => i.amount > 0).length} 笔收入
          </small>
        </article>
        <article data-ai-id="expense-card">
          <p>
            本月支出 <span className="orange">↗</span>
          </p>
          <h2>¥ {format(expense)}</h2>
          <small>
            <i className="dot orange-bg" />{" "}
            {items.filter((i) => i.amount < 0).length} 笔支出
          </small>
        </article>
      </section>
      <div className="content-grid">
        <section
          className="transactions"
          data-ai-id="transactions"
          data-ai-source="src/App.jsx"
        >
          <div className="section-head">
            <h3>最近账单</h3>
            <div className="tabs">
              {["全部", "支出", "收入"].map((t) => (
                <button
                  className={t === filter ? "active" : ""}
                  key={t}
                  onClick={() => setFilter(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          {items
            .filter(
              (i) =>
                filter === "全部" ||
                (filter === "支出" ? i.amount < 0 : i.amount > 0),
            )
            .map((item) => (
              <div className="transaction" key={item.id}>
                <span className="emoji">{item.emoji}</span>
                <div>
                  <strong>{item.name}</strong>
                  <p>
                    {item.category} · {item.date}
                  </p>
                </div>
                <b className={item.amount > 0 ? "positive" : ""}>
                  {item.amount > 0 ? "+" : "−"} {format(Math.abs(item.amount))}
                </b>
              </div>
            ))}
        </section>
        <aside
          className="spending"
          data-ai-id="spending-breakdown"
          data-ai-source="src/App.jsx"
        >
          <h3>支出分布</h3>
          <div
            className="donut"
            style={{
              background: expense
                ? `conic-gradient(${segments.join(",")})`
                : "#eef0e9",
            }}
          >
            <div>
              <small>本月支出</small>
              <strong>¥ {format(expense)}</strong>
            </div>
          </div>
          {["购物消费", "餐饮美食", "交通出行"].map((cat, i) => (
            <div className="category" key={cat}>
              <i style={{ background: ["#88a186", "#c3cfad", "#e4dec8"][i] }} />
              {cat}
              <strong>
                ¥{" "}
                {format(
                  -items
                    .filter((x) => x.category === cat && x.amount < 0)
                    .reduce((s, x) => s + x.amount, 0),
                )}
              </strong>
            </div>
          ))}
        </aside>
      </div>
      <footer>
        简单记录，慢慢积累。<span>小账本 / LITTLE LEDGER</span>
      </footer>
      {open && (
        <div className="backdrop">
          <form
            className="dialog"
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              const amount =
                Number(data.get("amount")) *
                (data.get("kind") === "支出" ? -1 : 1);
              const next = [
                {
                  id: Date.now(),
                  name: data.get("name"),
                  amount,
                  category:
                    data.get("kind") === "支出" ? "购物消费" : "工作收入",
                  date: "刚刚",
                  emoji: amount > 0 ? "↗" : "🛍",
                },
                ...items,
              ];
              setItems(next);
              localStorage.setItem(storageKey, JSON.stringify(next));
              setOpen(false);
            }}
          >
            <h2>记下这一笔</h2>
            <label>
              用途
              <input
                autoFocus
                name="name"
                required
                placeholder="这一笔用在哪里？"
              />
            </label>
            <label>
              金额
              <input
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                required
                placeholder="0.00"
              />
            </label>
            <label>
              类型
              <select name="kind">
                <option>支出</option>
                <option>收入</option>
              </select>
            </label>
            <div className="form-actions">
              <button type="button" onClick={() => setOpen(false)}>
                取消
              </button>
              <button className="primary" type="submit">
                保存记录
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
createRoot(document.getElementById("root")).render(<App />);
