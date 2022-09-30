import * as React from 'react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { pdf } from '@react-pdf/renderer';
import { StyleSheet, Document, Page, Text } from '@react-pdf/renderer';
import {
  AutoTRow,
  AutoTable,
  widthFromColStyles,
  expandAutoArray,
} from './Table';

function range(n: number) {
  // array filled with [0,n-1]
  return new Array(n).fill(0).map((_, idx) => idx);
}
function duplicate<T>(n: number, fn: (_: any, idx: number) => T): T[] {
  // array filled with [T,T,T,T,...]
  return new Array(n).fill(0).map(fn);
}

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    fontSize: '12px',
    padding: '20px 40px',
  },
  h2: {
    fontSize: '24px',
    marginBottom: '20px',
  },
});

interface TestTableProps {
  rows: number;
  cols: number;
}

function TestTablePage(props: TestTableProps) {
  const { rows, cols } = props;
  const colStyles = duplicate(cols, () => ({ width: 10 }));

  return (
    <React.Fragment>
      <Page style={styles.page} size={[612]}>
        <Text style={styles.h2}>{`Stress Test`}</Text>
        <AutoTable colStyles={colStyles}>
          {range(rows).map((rowIdx) => (
            <AutoTRow
              key={rowIdx}
              cells={range(cols).map((colIdx) => colIdx)}
            />
          ))}
        </AutoTable>
      </Page>
    </React.Fragment>
  );
}

const rootElement = document.getElementById('root');
const root = createRoot(rootElement);

async function run() {
  root.render(<div>STARTED</div>);

  const startTime = Date.now();
  const instance = pdf(
    <Document>
      <TestTablePage rows={500} cols={26} />
    </Document>
  );
  const endTime = Date.now();
  root.render(
    <div>
      <div>DONE in {endTime - startTime}ms</div>
    </div>
  );
  const blob = await instance.toBlob();
  const url = URL.createObjectURL(blob);
  root.render(
    <div>
      <button onClick={run}>Rerun</button>
      <div>DONE in {endTime - startTime}ms</div>
      <a href={url}>Open PDF</a>
    </div>
  );
}
root.render(
  <React.Fragment>
    <div>...</div>
    <button onClick={run}>START RENDERING 500*26 ELEMENT TABLE</button>
  </React.Fragment>
);
