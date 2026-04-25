"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useMemo, useState } from "react";

type AppShellProps = {
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
};

const navItems = [
  {
    href: "/",
    label: "题目列表",
    summary: "浏览题目、筛选结果、查看答案与进入编辑。",
    matches: (pathname: string) =>
      pathname === "/" || (pathname.startsWith("/questions/") && !pathname.startsWith("/questions/new"))
  },
  {
    href: "/questions/new",
    label: "新增题目",
    summary: "录入题目、执行查重并补充参考答案。",
    matches: (pathname: string) => pathname === "/questions/new"
  },
  {
    href: "/llm-configs",
    label: "LLM 配置",
    summary: "维护 OpenAI 兼容配置、启用状态与连接测试。",
    matches: (pathname: string) => pathname.startsWith("/llm-configs")
  }
];

export function AppShell({ title, description, actions, children }: AppShellProps) {
  const pathname = usePathname();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const currentNavItem = useMemo(
    () => navItems.find((item) => item.matches(pathname)) ?? navItems[0],
    [pathname]
  );

  function renderNavigation(onNavigate?: () => void) {
    return (
      <nav className="sidebar-nav" aria-label="主导航">
        {navItems.map((item) => {
          const active = item.matches(pathname);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-link ${active ? "sidebar-link-active" : ""}`}
              aria-current={active ? "page" : undefined}
              onClick={onNavigate}
            >
              <strong>{item.label}</strong>
              <span>{item.summary}</span>
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <main className="app-shell-root">
      <div className="app-frame">
        <aside className="app-sidebar">
          <div className="sidebar-brand">
            <span className="eyebrow">Problem Record</span>
            <h2>做题记录系统</h2>
            <p>单用户题库、错题沉淀与 LLM 配置管理。</p>
          </div>

          {renderNavigation()}
        </aside>

        <section className="app-main">
          <header className="mobile-shell-header">
            <button
              type="button"
              className="menu-toggle"
              aria-label="打开导航菜单"
              onClick={() => setIsDrawerOpen(true)}
            >
              <span />
              <span />
              <span />
            </button>

            <div className="mobile-shell-title">
              <span className="eyebrow">Problem Record</span>
              <strong>{currentNavItem.label}</strong>
            </div>
          </header>

          <section className="hero hero-compact content-hero">
            <div className="hero-topbar">
              <div>
                <span className="eyebrow">Workspace</span>
                <h1>{title}</h1>
                <p>{description}</p>
              </div>
              {actions ? <div className="hero-actions">{actions}</div> : null}
            </div>
          </section>

          <div className="app-content">{children}</div>
        </section>
      </div>

      <div
        className={`drawer-backdrop ${isDrawerOpen ? "drawer-backdrop-visible" : ""}`}
        onClick={() => setIsDrawerOpen(false)}
      />

      <aside className={`mobile-drawer ${isDrawerOpen ? "mobile-drawer-open" : ""}`}>
        <div className="mobile-drawer-head">
          <div>
            <span className="eyebrow">Navigate</span>
            <h3>页面切换</h3>
          </div>
          <button
            type="button"
            className="drawer-close"
            aria-label="关闭导航菜单"
            onClick={() => setIsDrawerOpen(false)}
          >
            ×
          </button>
        </div>

        {renderNavigation(() => setIsDrawerOpen(false))}
      </aside>
    </main>
  );
}
