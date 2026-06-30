import type { Aggregates, EntryDocument } from "../../../types/api";

interface Props {
  aggregates: Aggregates;
  entries: EntryDocument[];
  totalEntries: number;
}

export function IntentPanel(_props: Props) {
  return (
    <div className="panel-notice panel-notice--unavailable">
      <div className="panel-notice__icon">🚧</div>
      <div className="panel-notice__body">
        <strong>Module not yet implemented</strong>
        <p>
          Intent classification (complaint / suggestion / inquiry / compliment) requires a
          multi-class text classifier trained on labelled intent data. This module is planned for
          a future version of the pipeline.
        </p>
      </div>
    </div>
  );
}
