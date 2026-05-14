import { structuralEntities } from '@/domain/graph';
import { useDocumentStore } from '@/store';

/**
 * Session 77 / brief §10 mode "Annotation-included" — renders a
 * numbered list of every entity's description, plus per-edge
 * descriptions and per-edge assumptions, in the printed output.
 *
 * Hidden in normal view + when the user hasn't ticked "Include
 * annotation appendix" in the print preview. `print.css` gates
 * visibility on `body.print-include-appendix`.
 */
export function PrintAppendix() {
  const doc = useDocumentStore((s) => s.doc);
  const entities = structuralEntities(doc)
    .slice()
    .sort((a, b) => a.annotationNumber - b.annotationNumber);
  const edges = Object.values(doc.edges);

  return (
    <aside
      data-component="print-appendix"
      style={{
        padding: '24pt 0',
        fontFamily: 'inherit',
        color: '#171717',
      }}
    >
      <h2 style={{ fontSize: '14pt', marginBottom: '12pt' }}>Annotation appendix</h2>
      <ol style={{ paddingLeft: '24pt', margin: 0 }}>
        {entities.map((e) => (
          <li key={e.id} style={{ marginBottom: '8pt', fontSize: '11pt' }}>
            <strong>
              #{e.annotationNumber} — {e.title || '(untitled)'}
            </strong>
            {e.description && (
              <div style={{ marginTop: '2pt', whiteSpace: 'pre-wrap', color: '#404040' }}>
                {e.description}
              </div>
            )}
            {e.attestation && (
              <div
                style={{
                  marginTop: '2pt',
                  fontSize: '10pt',
                  fontStyle: 'italic',
                  color: '#525252',
                }}
              >
                Source: {e.attestation}
              </div>
            )}
          </li>
        ))}
      </ol>
      {edges.some((e) => e.description) && (
        <>
          <h3 style={{ fontSize: '12pt', marginTop: '12pt', marginBottom: '6pt' }}>Edge notes</h3>
          <ul style={{ paddingLeft: '24pt', margin: 0 }}>
            {edges
              .filter((e) => e.description)
              .map((e) => {
                const src = doc.entities[e.sourceId];
                const tgt = doc.entities[e.targetId];
                return (
                  <li key={e.id} style={{ marginBottom: '6pt', fontSize: '10pt' }}>
                    <strong>
                      #{src?.annotationNumber} → #{tgt?.annotationNumber}:
                    </strong>{' '}
                    <span style={{ whiteSpace: 'pre-wrap' }}>{e.description}</span>
                  </li>
                );
              })}
          </ul>
        </>
      )}
      {doc.assumptions && Object.keys(doc.assumptions).length > 0 && (
        <>
          <h3 style={{ fontSize: '12pt', marginTop: '12pt', marginBottom: '6pt' }}>
            Assumptions ({Object.keys(doc.assumptions).length})
          </h3>
          <ul style={{ paddingLeft: '24pt', margin: 0 }}>
            {Object.values(doc.assumptions).map((a) => (
              <li key={a.id} style={{ marginBottom: '4pt', fontSize: '10pt' }}>
                <span
                  style={{
                    fontSize: '9pt',
                    fontWeight: 700,
                    padding: '1pt 4pt',
                    borderRadius: '3pt',
                    marginRight: '6pt',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    backgroundColor:
                      a.status === 'invalid'
                        ? '#fee2e2'
                        : a.status === 'valid'
                          ? '#fef3c7'
                          : a.status === 'challengeable'
                            ? '#dbeafe'
                            : '#e5e5e5',
                  }}
                >
                  {a.status}
                </span>
                {a.text || '(empty)'}
              </li>
            ))}
          </ul>
        </>
      )}
    </aside>
  );
}
