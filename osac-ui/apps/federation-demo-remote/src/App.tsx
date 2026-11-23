import { useLocation } from 'react-router-dom';

const App = () => {
  const location = useLocation();
  if (new URLSearchParams(location.search).get('osac-plugin-test-failure') === 'true') {
    throw new Error('intentional demo plugin failure');
  }

  const release =
    (import.meta.env.VITE_FEDERATION_DEMO_RELEASE as string | undefined) ?? 'development';

  return (
    <section>
      <h1>Vite native federation demo</h1>
      <p>This page is loaded from a separately built OSAC UI remote.</p>
      <p>The host renders this component inside its existing application shell.</p>
      <p>Current host path: {location.pathname}</p>
      <p>Remote release: {release}</p>
    </section>
  );
};

export default App;
