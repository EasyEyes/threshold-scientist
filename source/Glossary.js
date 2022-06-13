import React, { Component, Suspense } from "react";
import { useTable, useFlexLayout } from "react-table";

import { GLOSSARY } from "../threshold/parameters/glossary-full.ts";

import "./css/Glossary.scss";

export default function Glossary({ closeGlossary }) {
  const columns = React.useMemo(
    () => [
      { accessor: "name", Header: "Name", className: "name" },
      // { accessor: "availability", Header: "Availability" },
      // { accessor: "default", Header: "Default", className: "default" },
      // { accessor: "example", Header: "Example", className: "example" },
      {
        accessor: "explanation",
        Header: "Explanation",
        className: "explanation",
      },
      { accessor: "type", Header: "Type", className: "type" },
      { accessor: "categories", Header: "Categories", className: "categories" },
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
    <div className="glossary">
      <div id="header">
        <div id="header-title">
          <h1>Threshold Input Glossary</h1>
        </div>
        {/* <p className="description">
          Welcome to EasyEyes, a PsychoJS-based experiment compiler designed
          to help you measure perceptual thresholds online.
        </p> */}
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
                      const availability = cell.row.original.availability;
                      let availabilityElement = null;
                      switch (availability) {
                        case "soon":
                          availabilityElement = (
                            <>
                              <br />
                              <span className="available available-soon">
                                soon
                              </span>
                            </>
                          );
                          break;
                        case "later":
                          availabilityElement = (
                            <>
                              <br />
                              <span className="available available-later">
                                later
                              </span>
                            </>
                          );
                          break;
                        default:
                          availabilityElement = <></>;
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
                          <p>
                            {cell.render("Cell")}
                            <br />
                            {isNameCell && (
                              <span className="default-value">
                                (default) {cell.row.original.default || "N/A"}
                              </span>
                            )}
                            {isNameCell && availabilityElement}
                          </p>
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
