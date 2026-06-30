import type { Aggregates, EntryDocument } from "../../../types/api";

interface Props {
  aggregates: Aggregates;
  entries: EntryDocument[];
  totalEntries: number;
}

export function AspectPanel(_props: Props) {
  return (
    <div className="panel-notice panel-notice--unavailable">
      <div className="panel-notice__icon">🚧</div>
      <div className="panel-notice__body">
        <strong>Module not yet implemented</strong>
        <p>
          Aspect-based sentiment extraction requires a dedicated NLP model (e.g. fine-tuned ABSA
          transformer). This module is planned for a future version of the pipeline.
        </p>
      </div>
    </div>
  );
}
