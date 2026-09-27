import type { ObjectInputProps } from "sanity";

export function VariantsInput(props: ObjectInputProps) {
  return (
    <div>
      <p
        style={{
          margin: "0 0 12px",
          padding: "10px 12px",
          borderRadius: 6,
          background: "#f3efe7",
          color: "#1c1915",
          fontSize: 13,
          lineHeight: 1.5,
        }}
      >
        Write each version in this field. Visitors are assigned one variant in edge middleware, before any HTML is sent,
        so the page does not flicker between them.
      </p>
      {props.renderDefault(props)}
    </div>
  );
}
