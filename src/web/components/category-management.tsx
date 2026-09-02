import { ArrowDown, ArrowUp, Check, Eye, EyeOff, Pencil, Tags, Trash2, X } from "lucide-react";
import { type CSSProperties, type SyntheticEvent, useMemo, useState } from "react";
import type { Category, CategoryUpdateInput } from "../api/planner";
import { SubpageHeader } from "./chrome";

type CategoryGroup = { id: string; name: string };

type CategoryDraft = {
	id: string;
	name: string;
	color: string;
	visibility: Category["visibility"];
	groupId: string;
};

type CategoryManagementProps = {
	categories: Category[] | undefined;
	groups: CategoryGroup[] | undefined;
	loading: boolean;
	error: boolean;
	groupsLoading: boolean;
	groupsError: boolean;
	onBack: () => void;
	onUpdate: (id: string, body: CategoryUpdateInput) => Promise<unknown>;
	onReorder: (id: string, position: number) => Promise<unknown>;
	onDelete: (id: string) => Promise<unknown>;
};

function categoryStyle(color: string) {
	return { "--cat-color": color } as CSSProperties;
}

function errorMessage(error: unknown) {
	return error instanceof Error ? error.message : "요청을 처리하지 못했어요.";
}

export function CategoryManagementScreen({
	categories,
	groups,
	loading,
	error,
	groupsLoading,
	groupsError,
	onBack,
	onUpdate,
	onReorder,
	onDelete,
}: CategoryManagementProps) {
	const [draft, setDraft] = useState<CategoryDraft | null>(null);
	const [pendingAction, setPendingAction] = useState<string | null>(null);
	const [notice, setNotice] = useState("");
	const [actionError, setActionError] = useState("");

	const orderedCategories = useMemo(
		() =>
			[...(categories ?? [])].sort(
				(left, right) =>
					(left.position ?? Number.MAX_SAFE_INTEGER) - (right.position ?? Number.MAX_SAFE_INTEGER),
			),
		[categories],
	);

	const beginEdit = (category: Category) => {
		setNotice("");
		setActionError("");
		setDraft({
			id: category.id,
			name: category.name,
			color: category.color,
			visibility: category.visibility,
			groupId: category.groupId ?? "",
		});
	};

	const saveCategory = async (event: SyntheticEvent<HTMLFormElement>, category: Category) => {
		event.preventDefault();
		if (!draft || draft.id !== category.id) return;
		const name = draft.name.trim();
		if (!name) {
			setActionError("카테고리 이름을 입력해 주세요.");
			return;
		}
		if (draft.visibility === "group" && category.visibility !== "group" && !draft.groupId) {
			setActionError("공유할 그룹을 선택해 주세요.");
			return;
		}

		const body: CategoryUpdateInput = {
			name,
			color: draft.color,
			visibility: draft.visibility,
		};
		if (draft.visibility === "group" && draft.groupId) {
			body.groupId = draft.groupId;
		}

		setPendingAction(`save:${category.id}`);
		setActionError("");
		try {
			await onUpdate(category.id, body);
			setDraft(null);
			setNotice(`${name} 카테고리를 저장했어요.`);
		} catch (caught) {
			setActionError(errorMessage(caught));
		} finally {
			setPendingAction(null);
		}
	};

	const moveCategory = async (category: Category, position: number) => {
		setPendingAction(`move:${category.id}`);
		setNotice("");
		setActionError("");
		try {
			await onReorder(category.id, position);
			setNotice(`${category.name} 순서를 변경했어요.`);
		} catch (caught) {
			setActionError(errorMessage(caught));
		} finally {
			setPendingAction(null);
		}
	};

	const removeCategory = async (category: Category) => {
		if (!window.confirm("카테고리와 안의 할 일/루틴을 모두 삭제할까요?")) return;
		setPendingAction(`delete:${category.id}`);
		setNotice("");
		setActionError("");
		try {
			await onDelete(category.id);
			setNotice(`${category.name} 카테고리를 삭제했어요.`);
		} catch (caught) {
			setActionError(errorMessage(caught));
		} finally {
			setPendingAction(null);
		}
	};

	return (
		<section
			className="management-screen"
			data-testid="category-management"
			aria-label="카테고리 관리"
		>
			<SubpageHeader title="카테고리 관리" onBack={onBack} />
			<p className="management-screen__intro">
				색상과 공개 범위를 정리하고, 자주 쓰는 순서대로 배치하세요.
			</p>

			<div className="management-feedback" aria-live="polite">
				{actionError ? <span className="management-feedback__error">{actionError}</span> : notice}
			</div>

			{loading ? (
				<div
					className="management-skeleton"
					role="status"
					aria-busy="true"
					aria-label="카테고리 불러오는 중"
				>
					<span className="skeleton" />
					<span className="skeleton" />
					<span className="skeleton" />
				</div>
			) : error ? (
				<div className="error-box">카테고리를 불러오지 못했어요.</div>
			) : orderedCategories.length === 0 ? (
				<div className="empty-state">
					<Tags aria-hidden="true" />
					<p>관리할 카테고리가 없어요. 홈에서 새 카테고리를 만들어 주세요.</p>
				</div>
			) : (
				<ol className="management-list">
					{orderedCategories.map((category, index) => {
						const editing = draft?.id === category.id;
						const busy = pendingAction !== null;
						return (
							<li
								key={category.id}
								className="management-card"
								data-category-id={category.id}
								style={categoryStyle(category.color)}
							>
								<div className="management-card__summary">
									<span className="management-card__color" aria-hidden="true" />
									<div className="management-card__copy">
										<strong>{category.name}</strong>
										<span className="management-card__meta">
											{category.visibility === "group" ? (
												<>
													<Eye aria-hidden="true" /> 그룹 공개
												</>
											) : (
												<>
													<EyeOff aria-hidden="true" /> 나만 보기
												</>
											)}
										</span>
									</div>
									<div className="management-card__actions">
										<button
											type="button"
											className="icon-btn"
											onClick={() => moveCategory(category, index - 1)}
											disabled={busy || index === 0}
											aria-label={`${category.name} 위로 이동`}
										>
											<ArrowUp aria-hidden="true" />
										</button>
										<button
											type="button"
											className="icon-btn"
											onClick={() => moveCategory(category, index + 1)}
											disabled={busy || index === orderedCategories.length - 1}
											aria-label={`${category.name} 아래로 이동`}
										>
											<ArrowDown aria-hidden="true" />
										</button>
										<button
											type="button"
											className="icon-btn"
											onClick={() => beginEdit(category)}
											disabled={busy}
											aria-label={`${category.name} 수정`}
										>
											<Pencil aria-hidden="true" />
										</button>
										<button
											type="button"
											className="icon-btn management-icon-btn--danger"
											onClick={() => void removeCategory(category)}
											disabled={busy}
											aria-label={`${category.name} 삭제`}
										>
											<Trash2 aria-hidden="true" />
										</button>
									</div>
								</div>

								{editing && draft ? (
									<form
										className="management-editor"
										onSubmit={(event) => saveCategory(event, category)}
									>
										<div className="management-editor__grid">
											<label className="management-field" htmlFor={`category-name-${category.id}`}>
												<span>이름</span>
												<input
													id={`category-name-${category.id}`}
													value={draft.name}
													onChange={(event) => setDraft({ ...draft, name: event.target.value })}
													maxLength={100}
												/>
											</label>
											<label className="management-field" htmlFor={`category-color-${category.id}`}>
												<span>색상</span>
												<span className="management-color-input" style={categoryStyle(draft.color)}>
													<input
														id={`category-color-${category.id}`}
														type="color"
														value={draft.color}
														onChange={(event) => setDraft({ ...draft, color: event.target.value })}
													/>
													<output>{draft.color.toUpperCase()}</output>
												</span>
											</label>
											<label
												className="management-field"
												htmlFor={`category-visibility-${category.id}`}
											>
												<span>공개 범위</span>
												<select
													id={`category-visibility-${category.id}`}
													value={draft.visibility}
													onChange={(event) => {
														const visibility = event.target.value as Category["visibility"];
														setDraft({
															...draft,
															visibility,
															groupId:
																visibility === "group"
																	? draft.groupId ||
																		(groups?.length === 1 ? (groups[0]?.id ?? "") : "")
																	: "",
														});
													}}
												>
													<option value="private">나만 보기</option>
													<option
														value="group"
														disabled={
															category.visibility !== "group" &&
															(groupsLoading || groupsError || !groups?.length)
														}
													>
														그룹 공개
													</option>
												</select>
											</label>
											{draft.visibility === "group" ? (
												<label
													className="management-field"
													htmlFor={`category-group-${category.id}`}
												>
													<span>공유 그룹</span>
													<select
														id={`category-group-${category.id}`}
														value={draft.groupId}
														onChange={(event) =>
															setDraft({ ...draft, groupId: event.target.value })
														}
														disabled={groupsLoading || groupsError}
													>
														<option value="">
															{category.visibility === "group"
																? "현재 공유 그룹 유지"
																: "그룹 선택"}
														</option>
														{groups?.map((group) => (
															<option key={group.id} value={group.id}>
																{group.name}
															</option>
														))}
													</select>
													{groupsLoading ? <small>그룹을 불러오는 중이에요.</small> : null}
													{groupsError ? <small>그룹 목록을 불러오지 못했어요.</small> : null}
												</label>
											) : null}
										</div>
										<div className="management-editor__actions">
											<button
												type="submit"
												className="btn-primary"
												disabled={pendingAction === `save:${category.id}`}
											>
												<Check aria-hidden="true" /> 저장
											</button>
											<button
												type="button"
												className="btn-ghost"
												onClick={() => setDraft(null)}
												disabled={busy}
											>
												<X aria-hidden="true" /> 취소
											</button>
										</div>
									</form>
								) : null}
							</li>
						);
					})}
				</ol>
			)}
		</section>
	);
}
