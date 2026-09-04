import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { ApiClientError, api, type InvitationPreview } from "../api/planner";

type VerifiedInvitation = {
	code: string;
	preview: InvitationPreview;
};

function invitationError(error: unknown) {
	if (!error) return "";
	if (!(error instanceof ApiClientError)) return "가입을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.";
	if (error.code === "USERNAME_TAKEN") return "이미 사용 중인 아이디예요.";
	if (error.status === 404) return "만료되었거나 이미 사용한 초대 코드예요.";
	return error.message;
}

export function InvitationSignupForm({
	initialCode,
	onShowLogin,
}: {
	initialCode: string;
	onShowLogin: () => void;
}) {
	const queryClient = useQueryClient();
	const [code, setCode] = useState(initialCode);
	const [username, setUsername] = useState("");
	const [name, setName] = useState("");
	const [password, setPassword] = useState("");
	const [passwordConfirmation, setPasswordConfirmation] = useState("");
	const [verified, setVerified] = useState<VerifiedInvitation | null>(null);
	const [validationError, setValidationError] = useState("");

	const preview = useMutation({
		mutationFn: (inviteCode: string) => api.invitationPreview(inviteCode),
		onSuccess: (result, inviteCode) => {
			setVerified({ code: inviteCode, preview: result });
			setValidationError("");
		},
	});
	const signup = useMutation({
		mutationFn: api.invitationSignup,
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["session"] }),
	});

	const trimmedCode = code.trim();
	const invitationVerified = verified?.code === trimmedCode;
	const checkCode = () => {
		if (!trimmedCode) {
			setValidationError("초대 코드를 입력해 주세요.");
			return;
		}
		preview.mutate(trimmedCode);
	};
	const submit = (event: FormEvent) => {
		event.preventDefault();
		setValidationError("");
		if (!invitationVerified) {
			setValidationError("초대 코드를 먼저 확인해 주세요.");
			return;
		}
		if (password !== passwordConfirmation) {
			setValidationError("비밀번호가 서로 달라요.");
			return;
		}
		signup.mutate({ code: trimmedCode, username: username.trim(), password, name: name.trim() });
	};
	const error = validationError || invitationError(preview.error ?? signup.error);

	return (
		<form className="login__form" onSubmit={submit}>
			<div className="login__heading">
				<div>
					<p className="eyebrow">INVITATION</p>
					<h2>초대 코드로 가입</h2>
				</div>
				<button type="button" className="btn-ghost" onClick={onShowLogin}>
					로그인
				</button>
			</div>
			<div className="field">
				<label htmlFor="signup-invite-code">초대 코드</label>
				<div className="login__inline-field">
					<input
						id="signup-invite-code"
						autoComplete="off"
						value={code}
						onChange={(event) => {
							setCode(event.target.value);
							setVerified(null);
						}}
						placeholder="받은 초대 코드를 입력해 주세요"
					/>
					<button
						type="button"
						className="btn-ghost"
						onClick={checkCode}
						disabled={preview.isPending}
					>
						{preview.isPending ? "확인 중…" : "코드 확인"}
					</button>
				</div>
			</div>
			{invitationVerified && verified ? (
				<div className="invitation-preview" role="status">
					<strong>{verified.preview.group.name}</strong>
					<span className="invitation-preview__detail">
						{verified.preview.inviter.name}님의 초대 · 가입 즉시 초대권 3개
					</span>
				</div>
			) : null}
			<div className="field">
				<label htmlFor="signup-name">닉네임</label>
				<input
					id="signup-name"
					autoComplete="name"
					value={name}
					onChange={(event) => setName(event.target.value)}
					minLength={1}
					maxLength={50}
					required
				/>
			</div>
			<div className="field">
				<label htmlFor="signup-username">아이디</label>
				<input
					id="signup-username"
					autoComplete="username"
					value={username}
					onChange={(event) => setUsername(event.target.value)}
					pattern="[A-Za-z0-9_]{3,30}"
					title="영문, 숫자, 밑줄로 3~30자"
					required
				/>
			</div>
			<div className="field">
				<label htmlFor="signup-password">비밀번호</label>
				<input
					id="signup-password"
					type="password"
					autoComplete="new-password"
					value={password}
					onChange={(event) => setPassword(event.target.value)}
					minLength={8}
					maxLength={128}
					required
				/>
			</div>
			<div className="field">
				<label htmlFor="signup-password-confirmation">비밀번호 확인</label>
				<input
					id="signup-password-confirmation"
					type="password"
					autoComplete="new-password"
					value={passwordConfirmation}
					onChange={(event) => setPasswordConfirmation(event.target.value)}
					minLength={8}
					maxLength={128}
					required
				/>
			</div>
			{error ? (
				<p className="error-box" role="alert">
					{error}
				</p>
			) : null}
			<button type="submit" className="btn-primary" disabled={signup.isPending}>
				{signup.isPending ? "가입 중…" : "가입하고 그룹 참여"}
			</button>
		</form>
	);
}
