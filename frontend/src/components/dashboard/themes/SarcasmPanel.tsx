import type { Aggregates, EntryDocument } from "../../../types/api";

interface Props {
  aggregates: Aggregates;
  entries: EntryDocument[];
  totalEntries: number;
  onExcludeToggle: () => void;
  excludeSarcasm: boolean;
}

export function SarcasmPanel(_props: Props) {
  return (
    <div className="panel-notice panel-notice--unavailable">
      <div className="panel-notice__icon">🚧</div>
      <div className="panel-notice__body">
        <strong>Module not yet implemented</strong>
        <p>
          Sarcasm detection requires a model trained specifically to recognise irony and figurative
          language (e.g. a fine-tuned RoBERTa on sarcasm corpora). This module is planned for a
          future version of the pipeline.
        </p>
      </div>
    </div>
  );
}
