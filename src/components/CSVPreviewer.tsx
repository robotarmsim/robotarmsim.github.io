import React from 'react';
//import { useRef, useState } from 'react';

interface CSVPreviewerProps {
  rows: string[][];
  hasHeader?: boolean; // get rid of the header cause its irrelevant
  headerLabel?: string; // optional custom header independent from csv
}

export const CSVPreviewer: React.FC<CSVPreviewerProps> = ({
  rows,
  hasHeader = false,
  headerLabel,
}) => {
  return (
    <div id="csvPreview">
      {headerLabel && <div className="csv-header-label">{headerLabel}</div>}
      {rows.length === 0 ? (
        <p>No CSV loaded.</p>
      ) : (
        <table id="csvTable">
          {hasHeader && rows.length > 0 && (
            <thead>
              <tr>
                {rows[0].map((cell, i) => (
                  <th key={`head-${i}`}>{cell}</th>
                ))}
              </tr>
            </thead>
          )}
          <tbody id="csvTableBody">
            {rows.map((row, rowIndex) => {
              if (hasHeader && rowIndex === 0) return null;
              return (
                <tr key={`row-${rowIndex}`}>
                  {row.map((cell, cellIndex) => (
                    <td key={`cell-${rowIndex}-${cellIndex}`}>{cell}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
};

// export const CSVPreviewer: React.FC = () => {
//   const fileInputRef = useRef<HTMLInputElement>(null);
//   const [csvRows, setCsvRows] = useState<string[][]>([]);

//   const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     const file = e.target.files?.[0];
//     if (!file) return;

//     const reader = new FileReader();
//     reader.onload = (event) => {
//       const text = event.target?.result as string;
//       parseCsv(text);
//     };
//     reader.readAsText(file);
//   };

//   const parseCsv = (text: string) => {
//     const rows = text
//       .trim()
//       .split('\n')
//       .map((row) => row.split(','));

//     setCsvRows(rows);
//   };

//   return (
//     <section>
//       <input
//         type="file"
//         accept=".csv"
//         onChange={handleFileChange}
//         ref={fileInputRef}
//       />

//       <div id="csvPreview">
//         {csvRows.length === 0 ? (
//           <p>No CSV loaded.</p>
//         ) : (
//           <table id="csvTable">
//             <thead>
//               <tr>
//                 {csvRows[0].map((cell, i) => (
//                   <th key={`head-${i}`}>{cell}</th>
//                 ))}
//               </tr>
//             </thead>
//             <tbody id="csvTableBody">
//               {csvRows.slice(1).map((row, rowIndex) => (
//                 <tr key={`row-${rowIndex}`}>
//                   {row.map((cell, cellIndex) => (
//                     <td key={`cell-${rowIndex}-${cellIndex}`}>{cell}</td>
//                   ))}
//                 </tr>
//               ))}
//             </tbody>
//           </table>
//         )}
//       </div>
//     </section>
//   );
// };
