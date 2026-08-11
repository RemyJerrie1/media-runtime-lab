type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  description?: string;
};

export function SectionHeading({ eyebrow, title, description }: SectionHeadingProps) {
  return <header>
    <p className="eyebrow">{eyebrow}</p>
    <h2>{title}</h2>
    {description ? <p className="lede">{description}</p> : null}
  </header>;
}
