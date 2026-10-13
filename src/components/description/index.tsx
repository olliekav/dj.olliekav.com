import { linkify } from '../../utilities/format';

const Description = ({ text, class: className }: { text: string; class?: string }) => (
  <div class={className}>
    {linkify(text).map((part, i) =>
      typeof part === 'string' ? part : (
        <a key={i} href={part.href} target="_blank" rel="noopener noreferrer">{part.text}</a>
      )
    )}
  </div>
);

export default Description;
