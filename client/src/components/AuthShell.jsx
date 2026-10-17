import { KanbanSquare, MessagesSquare, Radio, Users } from 'lucide-react';
import Logo from './Logo';

const FEATURES = [
  { icon: Users, text: 'Create group projects and invite your team' },
  { icon: KanbanSquare, text: 'Drag-and-drop boards with assignable task cards' },
  { icon: MessagesSquare, text: 'Discuss work in comment threads on every task' },
  { icon: Radio, text: 'Live updates and notifications over WebSockets' },
];

export default function AuthShell({ title, subtitle, children }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-indigo-600 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full border-[40px] border-white/10" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-indigo-500/60" />
        <div className="relative flex items-center gap-2.5">
          <Logo size={32} />
          <span className="text-lg font-semibold">Orbit</span>
        </div>
        <div className="relative max-w-md">
          <h1 className="text-4xl leading-tight font-semibold tracking-tight">Keep every project moving, together.</h1>
          <ul className="mt-8 space-y-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-indigo-100">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
                  <Icon size={18} />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-indigo-200">Built by Syed Shaheer Ahmed · CodeAlpha Full Stack Internship</p>
      </div>

      <div className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <Logo />
            <span className="font-semibold">Orbit</span>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
          <p className="mt-1.5 text-sm text-zinc-500">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
