async function testViralRoastFlow() {
  console.log('--- Testing Viral Resume Roast Engine ---');

  // 1. Upload sample resume with juicy corporate buzzwords and weak bullets
  const samplePdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length 280 >> stream
BT /F1 12 Tf 72 712 Td (Chad Doe - Passionate Results-Driven Team Player) Tj 
0 -20 Td (Summary: Dynamic go-getter seeking challenging opportunities to synergize cross-functional deliverables.) Tj
0 -20 Td (Experience: Software Engineer at Acme Corp) Tj
0 -20 Td (• Responsible for developing various features and assisting team.) Tj
0 -20 Td (• Developed code and developed solutions using React, Node, and Docker.) Tj
0 -20 Td (• Participated in agile meetings and handled daily standup tasks.) Tj
ET
endstream endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000244 00000 n 
0000000575 00000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
650
%%EOF`;

  const form = new FormData();
  form.append('resume', new Blob([samplePdf], { type: 'application/pdf' }), 'chad_resume.pdf');
  form.append('targetJob', 'Senior Frontend Engineer');
  form.append('jobDescription', 'Fast-paced environment building high-performance web applications.');

  const uploadRes = await fetch('http://localhost:3000/api/upload', {
    method: 'POST',
    body: form
  });
  const uploadData = await uploadRes.json();
  const orderId = uploadData.orderId;
  console.log('1. Uploaded & Created Order:', orderId);

  // 2. Submit UTR
  await fetch(`http://localhost:3000/api/orders/${orderId}/utr`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ utr: 'UTR_CHAD_77777777' })
  });
  console.log('2. UTR Submitted');

  // 3. Operator Approves Order
  const verifyRes = await fetch(`http://localhost:3000/api/admin/orders/${orderId}/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-secret': 'deadcv666'
    },
    body: JSON.stringify({ action: 'approve' })
  });
  const verifyData = await verifyRes.json();
  console.log('3. Operator Verification:', verifyData.message);

  // 4. Request Roast Generation
  const roastRes = await fetch(`http://localhost:3000/api/orders/${orderId}/roast`);
  const roastData = await roastRes.json();
  console.log('\n--- 4. GENERATED VIRAL ROAST RESULT ---');
  console.log('Dead Score:', roastData.roast.deadPercentage + '% DEAD');
  console.log('Cause of Death:', roastData.roast.causeOfDeath);
  console.log('Stats:', roastData.roast.stats);
  console.log('Roasts:', roastData.roast.roasts);
  console.log('Recruiter Reaction:', roastData.roast.recruiterReaction);
  console.log('Share Text:\n' + roastData.roast.shareText);
  console.log('\n VIRAL ROAST TEST PASSED 100%! ');
}

testViralRoastFlow().catch(console.error);
