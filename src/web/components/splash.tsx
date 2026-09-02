import { BrandCloud } from "./ui";

export function Splash() {
	return (
		<div className="splash">
			<div style={{ display: "grid", justifyItems: "center", gap: "16px" }}>
				<BrandCloud className="brand-cloud cloud-glyph" />
				<p>
					Loading todo mate<span className="ellipsis" />
				</p>
			</div>
		</div>
	);
}
