import SocialPostsNav from "./SocialPostsNav";

type Props = {
  title: string;
  description?: string;
  query?: string;
  singleLineTitle?: boolean;
};

export default function SocialPostsPageHeader({
  title,
  description,
  query = "",
  singleLineTitle = false,
}: Props) {
  return (
    <header className="sp-header">
      <div>
        <p className="sp-eyebrow">Jumping Jax · AI Marketing</p>
        <h1 className={singleLineTitle ? "sp-title sp-title-single-line" : "sp-title"}>
          {title}
        </h1>
        {description ? <p className="sp-lede">{description}</p> : null}
      </div>
      <SocialPostsNav query={query} />
    </header>
  );
}
