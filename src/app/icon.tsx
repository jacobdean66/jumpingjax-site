import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#0f1f3d",
          color: "white",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          justifyContent: "center",
          width: "100%",
        }}
      >
        <div
          style={{
            color: "#22b8c7",
            display: "flex",
            fontSize: 226,
            fontWeight: 900,
            letterSpacing: -22,
            lineHeight: 0.8,
            marginRight: 22,
          }}
        >
          JX
        </div>
        <div
          style={{
            color: "#ffad20",
            display: "flex",
            fontSize: 48,
            fontWeight: 800,
            letterSpacing: 10,
            marginTop: 28,
          }}
        >
          JUMPING JAX
        </div>
      </div>
    ),
    size,
  );
}
