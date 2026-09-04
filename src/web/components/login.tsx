import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiClientError } from "../api/planner";
import { BrandCloud } from "./ui";
import { InvitationSignupForm } from "./invitation-signup";

export function LoginScreen() {
	const queryClient = useQueryClient();
	const initialCode =
		typeof window === "undefined" ? "" : (new URLSearchParams(window.location.search).get("invite") ?? "");
	const [mode, setMode] = useState<"login" | "signup">(initialCode ? "signup" : "login");
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");

	const signIn = useMutation({
		mutationFn: () => api.signIn(username.trim(), password),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["session"] }),
	});

	const submit = (event: FormEvent) => {
		event.preventDefault();
		if (!username.trim() || !password) {
			return;
		}
		signIn.mutate();
	};

	const errorMessage =
		signIn.error instanceof ApiClientError
			? signIn.error.message
			: signIn.isError
				? "로그인에 실패했어요. 잠시 후 다시 시도해 주세요."
				: null;

	const brand = (
		<section className="login__brand">
			<BrandCloud className="brand-cloud" />
			<h1>
				todo <span>mate</span>
			</h1>
			<p>오늘의 할 일을 정리하고, 루틴으로 습관을 만들고, 일기로 하루를 돌아보세요.</p>
			<p className="login__motto">each task shapes who we become.</p>
		</section>
	);

	if (mode === "signup") {
		return (
			<main className="login">
				{brand}
				<InvitationSignupForm initialCode={initialCode} onShowLogin={() => setMode("login")} />
			</main>
		);
	}

	return (
		<main className="login">
			{brand}
			<form className="login__form" onSubmit={submit}>
				<div className="login__heading">
					<h2>로그인</h2>
					<button type="button" className="btn-ghost" onClick={() => setMode("signup")}>
						초대 코드로 가입
					</button>
				</div>
				<div className="field">
					<label htmlFor="login-username">아이디</label>
					<input
						id="login-username"
						autoComplete="username"
						value={username}
						onChange={(event) => setUsername(event.target.value)}
						placeholder="아이디를 입력해 주세요"
					/>
				</div>
				<div className="field">
					<label htmlFor="login-password">비밀번호</label>
					<input
						id="login-password"
						type="password"
						autoComplete="current-password"
						value={password}
						onChange={(event) => setPassword(event.target.value)}
						placeholder="비밀번호를 입력해 주세요"
					/>
				</div>
				{errorMessage ? <p className="error-box">{errorMessage}</p> : null}
				<button type="submit" className="btn-primary" disabled={signIn.isPending}>
					{signIn.isPending ? "로그인 중…" : "로그인"}
				</button>
				<p className="login__legal">
					로그인하면 이용약관과 개인정보처리방침에 동의하는 것으로 간주돼요.
				</p>
			</form>
		</main>
	);
}
