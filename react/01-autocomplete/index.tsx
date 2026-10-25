export type AutocompleteProps = {
  label: string;
  fetchSuggestions: (query: string, signal: AbortSignal) => Promise<string[]>;
  onSelect: (value: string) => void;
  debounceMs?: number;
  minChars?: number;
};

export function Autocomplete(props: AutocompleteProps) {
  // TODO: implement. See README.md for the full spec.
  return <div>TODO: implement Autocomplete</div>;
}
