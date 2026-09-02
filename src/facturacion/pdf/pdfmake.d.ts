// pdfmake no publica declaraciones de tipos para su API de servidor
// (createPdf/getBuffer). Se tipa como `any` deliberadamente — es un import
// explícito, no implícito, así que es compatible con "strict": true.
declare module 'pdfmake' {
  const pdfMake: any;
  export default pdfMake;
}
