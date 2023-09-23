import React, { Suspense } from "react";
import { useTable, useFlexLayout } from "react-table";

import { GLOSSARY } from "../threshold/parameters/glossary-full.ts";

import "./css/Glossary.scss";

export default function Glossary({ closeGlossary }) {
  const columns = React.useMemo(
    () => [
      { accessor: "name", Header: "Name", className: "name" },
      {
        accessor: "explanation",
        Header: "Explanation",
        className: "explanation",
      },
    ],
    []
  );

  const data = React.useMemo(() => GLOSSARY, []);

  const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow } =
    useTable(
      {
        columns,
        data,
      },
      useFlexLayout
    );

  return (
    <div className="glossary cover-fadeInUp">
      <div id="header">
        <div id="header-title">
          <h1>EasyEyes Input Glossary</h1>
        </div>
        <button
          className="intro-button"
          onClick={() => {
            closeGlossary();
          }}
        >
          🎬&nbsp;&nbsp;Go back to compiler
        </button>
      </div>

      <Suspense>
        <div className="tableWrap">
          <table {...getTableProps()}>
            <thead>
              {headerGroups.map((headerGroup, index) => (
                <tr
                  key={index}
                  className="table-header"
                  {...headerGroup.getHeaderGroupProps()}
                >
                  {headerGroup.headers.map((column, ind) => (
                    <th
                      key={`${index}-${ind}`}
                      className={column.accessor}
                      {...column.getHeaderProps([
                        {
                          className: `header-cell ${column.className}`,
                        },
                      ])}
                    >
                      {column.render("Header")}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody {...getTableBodyProps()}>
              {rows.map((row, i) => {
                prepareRow(row);
                return (
                  <tr key={`body-${i}`} {...row.getRowProps()}>
                    {row.cells.map((cell, ind) => {
                      const isNameCell = cell.column.className === "name";
                      const isCategoryParam =
                        cell.row.original.type.includes("categorical");

                      const availability = cell.row.original.availability;
                      let availabilityElement = null;
                      switch (availability) {
                        case "now":
                          availabilityElement = <></>;
                          break;
                        default:
                          availabilityElement = (
                            <>
                              <span
                                className={`available available-${availability}`}
                              >
                                {availability}
                              </span>
                            </>
                          );
                      }

                      return (
                        <td
                          key={`body-${i}-${ind}`}
                          {...cell.getCellProps([
                            {
                              className: `cell ${cell.column.className}`,
                            },
                          ])}
                        >
                          {cell.column.className === "type" ? (
                            cell.render("Cell")
                          ) : (
                            <p>
                              {isNameCell && availabilityElement}
                              {cell.render("Cell")}
                              {isNameCell && (
                                <>
                                  {/* <br /> */}
                                  <span className="default-value">
                                    {cell.row.original.type || "NO TYPE"}
                                    &nbsp;|&nbsp;(default){" "}
                                    {cell.row.original.default || "EMPTY"}
                                  </span>
                                </>
                              )}
                              {isNameCell && cell.row.original.example && (
                                <>
                                  {/* <br /> */}
                                  <span className="default-value">
                                    (example){" "}
                                    {cell.row.original.example || "EMPTY"}
                                  </span>
                                </>
                              )}
                              {isNameCell && isCategoryParam && (
                                <>
                                  {/* <br /> */}
                                  <span
                                    className="default-value"
                                    style={{
                                      display: "inline-block",
                                      fontSize: "0.7rem",
                                      lineHeight: "135%",
                                    }}
                                  >
                                    (categories){" "}
                                    {cell.row.original.categories || "EMPTY"}
                                  </span>
                                </>
                              )}
                            </p>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Suspense>
    </div>
  );
}
