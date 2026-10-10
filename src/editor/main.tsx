import { Component, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import "./styles.css";

/** A crash shows what broke and a way back, instead of a blank page. */
class Boundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="home">
        <h1>Algo ha fallado</h1>
        <div className="error">{this.state.error.message}</div>
        <p>
          <button className="primary" onClick={() => (location.href = "/")}>
            Volver a la biblioteca
          </button>{" "}
          <button onClick={() => location.reload()}>Reintentar</button>
        </p>
      </div>
    );
  }
}

createRoot(document.getElementById("root")!).render(
  <Boundary>
    <App />
  </Boundary>,
);
