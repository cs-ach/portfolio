/* Structured data for search engines, printed as a script tag.

   JSON.stringify output is safe inside a JSON script except for one
   thing: a "<" in a string could close the tag early ("</script>") and
   let the rest of the string be parsed as markup. Escaping it as <
   keeps the JSON identical to a parser and inert to the HTML parser. */

export default function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
