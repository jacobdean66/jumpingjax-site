import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#0f1f3d",
          color: "#22b8c7",
          display: "flex",
          fontSize: 82,
          fontWeight: 900,
          height: "100%",
          justifyContent: "center",
          letterSpacing: -8,
          paddingRight: 8,
          width: "100%",
        }}
      >
        JX
      </div>
    ),
    size,
  );
}
