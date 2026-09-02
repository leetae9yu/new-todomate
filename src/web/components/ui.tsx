import { Check } from "lucide-react";
import type { CSSProperties, ReactElement, ReactNode } from "react";

/** Brand glyph — cloud/puff of rounded square bubbles (original mark). */
export function BrandCloud({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 48 48" className={className} aria-hidden="true">
			<rect x="4" y="16" width="22" height="22" rx="7.5" />
			<rect x="14" y="4" width="20" height="20" rx="7" />
			<rect x="26" y="12" width="18" height="18" rx="6.5" />
			<rect x="14" y="26" width="26" height="18" rx="6.5" />
		</svg>
	);
}

/** Week-strip completion cloud — gray outline, colorful when fully done. */
export function CloudMark({ done }: { done: boolean }) {
	return (
		<svg viewBox="0 0 24 24" className="week-strip__cloud" aria-hidden="true">
			<rect x="2.5" y="8" width="11" height="11" rx="4" />
			<rect x="7.5" y="2.5" width="10" height="10" rx="3.6" />
			<rect x="13" y="6.5" width="9" height="9" rx="3.2" />
			<rect x="7" y="13.5" width="12.5" height="8" rx="3.2" />
			{done ? (
				<path
					d="M8.6 12.4l2.3 2.3 4.2-4.6"
					stroke="var(--bg)"
					strokeWidth="1.8"
					strokeLinecap="round"
					strokeLinejoin="round"
					fill="none"
				/>
			) : null}
		</svg>
	);
}

/** Squircle checkbox — soft-edged square, the recognizability signature. */
export function Squircle({
	done,
	color,
	staticBox = false,
	label = "완료 상태 전환",
}: {
	done: boolean;
	color: string;
	staticBox?: boolean;
	label?: string;
}) {
	const className = `squircle${done ? " squircle--done" : ""}${
		staticBox ? " squircle--static" : ""
	}`;
	return (
		<span
			className={className}
			style={{ "--cat-color": color } as CSSProperties}
			role="img"
			aria-label={label}
		>
			{done ? <Check strokeWidth={3.5} aria-hidden="true" /> : null}
		</span>
	);
}

export function EmptyState({ icon, message }: { icon?: ReactNode; message: string }) {
	return (
		<div className="empty-state">
			{icon ? <span aria-hidden="true">{icon}</span> : null}
			{message}
		</div>
	);
}

export function ErrorBox({ message }: { message: string }) {
	return <div className="error-box">{message}</div>;
}

export function LoadingCard({ width = "100%" }: { width?: string }) {
	return <span className="skeleton" style={{ width }} />;
}

export type { ReactElement };
