import { render, type RenderResult } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { AppProviders } from "../app/AppProviders";

export const renderWithProviders = (
  element: ReactElement,
  initialEntries: string[] = ["/"],
): RenderResult =>
  render(
    <AppProviders>
      <MemoryRouter initialEntries={initialEntries}>{element}</MemoryRouter>
    </AppProviders>,
  );
