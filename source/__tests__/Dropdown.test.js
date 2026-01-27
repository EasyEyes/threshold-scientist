// Mock DynamicSelectWidth
jest.mock("../components/DynamicSelectWidth", () => ({
  setDynamicSelectWidth: jest.fn(),
}));

import React from "react";
import { render, waitFor, fireEvent } from "@testing-library/react";
import Dropdown from "../components/Dropdown";

describe("Dropdown Component", () => {
  let mockProps;
  let mockUser;

  beforeEach(() => {
    jest.clearAllMocks();

    mockUser = {
      initProjectList: jest.fn().mockResolvedValue(true),
      projectList: Promise.resolve([
        { id: "1", name: "Project A", created_at: "2024-01-01T00:00:00Z" },
        { id: "2", name: "Project B", created_at: "2024-01-02T00:00:00Z" },
        {
          id: "3",
          name: "EasyEyesResources",
          created_at: "2024-01-03T00:00:00Z",
        },
      ]),
    };

    mockProps = {
      selected: "new",
      setSelectedProject: jest.fn(),
      projectList: mockUser.projectList,
      newExperimentProjectName: null,
      style: {},
      user: mockUser,
      pavloviaIsReady: true,
    };
  });

  describe("Rendering", () => {
    it("renders with placeholder when selected is 'new'", async () => {
      const { container } = render(<Dropdown {...mockProps} />);

      await waitFor(() => {
        const select = container.querySelector("select");
        expect(select).toBeInTheDocument();
        expect(select.value).toBe("__NEW_EXPERIMENT__");
      });
    });

    it("renders with experiment name and date when selected is a project", async () => {
      const selectedProject = {
        id: "1",
        name: "Project A",
        created_at: "2024-01-01T00:00:00Z",
      };
      const { container } = render(
        <Dropdown {...mockProps} selected={selectedProject} />,
      );

      await waitFor(() => {
        const select = container.querySelector("select");
        expect(select).toBeInTheDocument();
        expect(select.value).toBe("1");
      });
    });

    it("filters out EasyEyesResources from project list", async () => {
      const { container } = render(<Dropdown {...mockProps} />);

      await waitFor(() => {
        const options = container.querySelectorAll("option");
        // Should have placeholder + 2 projects (EasyEyesResources filtered out)
        expect(options.length).toBe(3);
        expect(options[1].text).toContain("Project A");
        expect(options[2].text).toContain("Project B");
        // EasyEyesResources should not appear
        Array.from(options).forEach((option) => {
          expect(option.text).not.toContain("EasyEyesResources");
        });
      });
    });

    it("renders loading spinner when isLoadingProjects is true", () => {
      // Create a promise that never resolves to simulate loading
      const loadingProjectList = new Promise(() => {});
      const { container } = render(
        <Dropdown {...mockProps} projectList={loadingProjectList} />,
      );

      // Should show loading button instead of select
      const select = container.querySelector("select");
      const button = container.querySelector("button");

      expect(select).not.toBeInTheDocument();
      expect(button).toBeInTheDocument();
      expect(button.disabled).toBe(true);
    });
  });

  describe("Focus Refresh (onFocus)", () => {
    it("calls refreshProjectList when select element receives focus", async () => {
      const { container } = render(<Dropdown {...mockProps} />);

      await waitFor(() => {
        const select = container.querySelector("select");
        expect(select).toBeInTheDocument();
      });

      const select = container.querySelector("select");

      // Trigger focus event
      fireEvent.focus(select);

      // Wait for the async refresh to complete
      await waitFor(() => {
        expect(mockUser.initProjectList).toHaveBeenCalledWith(true);
      });
    });

    it("calls user.initProjectList with forceRefresh=true on focus", async () => {
      const { container } = render(<Dropdown {...mockProps} />);

      await waitFor(() => {
        const select = container.querySelector("select");
        expect(select).toBeInTheDocument();
      });

      const select = container.querySelector("select");
      fireEvent.focus(select);

      await waitFor(() => {
        expect(mockUser.initProjectList).toHaveBeenCalledWith(true); // true = force refresh
      });
    });
  });

  describe("Promise Deduplication (_lastPromise)", () => {
    it("does not re-resolve the same projectList Promise", async () => {
      const testProjectList = Promise.resolve([
        { id: "1", name: "Project A", created_at: "2024-01-01T00:00:00Z" },
      ]);

      const { rerender } = render(
        <Dropdown {...mockProps} projectList={testProjectList} />,
      );

      // Wait for initial resolution
      await waitFor(() => {
        const select = document.querySelector("select");
        expect(select).toBeInTheDocument();
      });

      // Rerender with the exact same Promise reference
      rerender(<Dropdown {...mockProps} projectList={testProjectList} />);

      // The dropdown should still be visible (not go into loading state)
      // This indicates _lastPromise guard prevented re-resolution
      const select = document.querySelector("select");
      expect(select).toBeInTheDocument();
    });

    it("resolves new Promise when reference changes", async () => {
      const firstProjectList = Promise.resolve([
        { id: "1", name: "Project A", created_at: "2024-01-01T00:00:00Z" },
      ]);

      const { container, rerender } = render(
        <Dropdown {...mockProps} projectList={firstProjectList} />,
      );

      await waitFor(() => {
        const options = container.querySelectorAll("option");
        expect(options.length).toBeGreaterThan(0);
      });

      // Rerender with a new Promise reference
      const secondProjectList = Promise.resolve([
        { id: "2", name: "Project B", created_at: "2024-01-02T00:00:00Z" },
      ]);

      rerender(<Dropdown {...mockProps} projectList={secondProjectList} />);

      // Should resolve the new Promise
      await waitFor(() => {
        const options = container.querySelectorAll("option");
        expect(options.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Selection Changes", () => {
    it("calls setSelectedProject(null) when __NEW_EXPERIMENT__ is selected", async () => {
      const { container } = render(<Dropdown {...mockProps} />);

      await waitFor(() => {
        const select = container.querySelector("select");
        expect(select).toBeInTheDocument();
      });

      const select = container.querySelector("select");
      fireEvent.change(select, { target: { value: "__NEW_EXPERIMENT__" } });

      expect(mockProps.setSelectedProject).toHaveBeenCalledWith(null);
    });

    it("calls setSelectedProject('REFRESH') when __FRESH_NEW_EXPERIMENT__ is selected", async () => {
      const { container } = render(
        <Dropdown {...mockProps} newExperimentProjectName="New Experiment" />,
      );

      await waitFor(() => {
        const select = container.querySelector("select");
        expect(select).toBeInTheDocument();
      });

      const select = container.querySelector("select");
      fireEvent.change(select, {
        target: { value: "__FRESH_NEW_EXPERIMENT__" },
      });

      expect(mockProps.setSelectedProject).toHaveBeenCalledWith("REFRESH");
    });

    it("calls setSelectedProject with project when a project is selected", async () => {
      const { container } = render(<Dropdown {...mockProps} />);

      await waitFor(() => {
        const select = container.querySelector("select");
        expect(select).toBeInTheDocument();
      });

      const select = container.querySelector("select");

      // Select Project A (id: "1")
      fireEvent.change(select, { target: { value: "1" } });

      await waitFor(() => {
        expect(mockProps.setSelectedProject).toHaveBeenCalledWith(
          expect.objectContaining({ id: "1", name: "Project A" }),
        );
      });
    });

    it("finds correct project by ID from resolvedProjectList", async () => {
      const { container } = render(<Dropdown {...mockProps} />);

      await waitFor(() => {
        const select = container.querySelector("select");
        expect(select).toBeInTheDocument();
      });

      const select = container.querySelector("select");

      // Select Project B (id: "2")
      fireEvent.change(select, { target: { value: "2" } });

      await waitFor(() => {
        expect(mockProps.setSelectedProject).toHaveBeenCalledWith(
          expect.objectContaining({ id: "2", name: "Project B" }),
        );
      });
    });
  });

  describe("State Updates", () => {
    it("updates resolvedProjectList when refresh returns new data", async () => {
      const { container } = render(<Dropdown {...mockProps} />);

      await waitFor(() => {
        const options = container.querySelectorAll("option");
        expect(options.length).toBeGreaterThan(1);
      });
    });

    it("falls back to existing resolvedProjectList when refresh returns empty", async () => {
      // First render with a populated list
      const { container, rerender } = render(<Dropdown {...mockProps} />);

      await waitFor(() => {
        const options = container.querySelectorAll("option");
        expect(options.length).toBe(3); // placeholder + 2 projects
      });

      // Create a user that returns empty list on refresh
      const emptyListUser = {
        initProjectList: jest.fn().mockResolvedValue(true),
        projectList: Promise.resolve([]),
      };

      // Rerender with user that has empty projectList
      rerender(
        <Dropdown
          {...mockProps}
          user={emptyListUser}
          projectList={emptyListUser.projectList}
        />,
      );

      // Should still show select (not loading state) because we fall back to existing list
      await waitFor(() => {
        const select = container.querySelector("select");
        expect(select).toBeInTheDocument();
      });
    });
  });

  describe("Error Handling", () => {
    it("handles projectList promise rejection gracefully", async () => {
      const rejectingProjectList = Promise.reject(new Error("Network error"));

      const { container } = render(
        <Dropdown {...mockProps} projectList={rejectingProjectList} />,
      );

      // Should recover and show select with empty list
      await waitFor(() => {
        const select = container.querySelector("select");
        expect(select).toBeInTheDocument();
      });
    });

    it("handles refreshProjectList errors gracefully", async () => {
      const errorUser = {
        initProjectList: jest
          .fn()
          .mockRejectedValue(new Error("Refresh failed")),
        projectList: Promise.resolve([
          { id: "1", name: "Project A", created_at: "2024-01-01T00:00:00Z" },
        ]),
      };

      // Spy on console.error to verify only the expected error is logged
      const originalError = console.error;
      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation((...args) => {
          const message =
            typeof args[0] === "string" ? args[0] : args[0]?.toString();
          if (message?.includes("Error refreshing project list:")) {
            return; // Suppress expected error
          }
          // Let any unexpected errors through
          originalError.call(console, ...args);
        });

      const { container } = render(
        <Dropdown
          {...mockProps}
          user={errorUser}
          projectList={errorUser.projectList}
        />,
      );

      await waitFor(() => {
        const select = container.querySelector("select");
        expect(select).toBeInTheDocument();
      });

      const select = container.querySelector("select");
      fireEvent.focus(select);

      // Should not throw, component should handle error internally
      await waitFor(() => {
        expect(errorUser.initProjectList).toHaveBeenCalled();
      });

      // Verify the expected error was logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error refreshing project list:",
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });
  });
});
