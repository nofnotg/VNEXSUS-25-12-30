/**
 * Fetch frontend assets to confirm availability
 */

async function main() {
  try {
    const base = 'http://localhost:8080';
    const paths = ['/index.html', '/script.js'];
    for (const p of paths) {
      const url = base + p;
      const res = await fetch(url);
      const text = await res.text();
      console.log('\nURL:', url);
      console.log('Status:', res.status);
      console.log('Length:', text.length);
      console.log('Preview:', text.slice(0, 200));
    }
  } catch (err) {
    console.error('Frontend fetch error:', err.message);
  }
}

main();