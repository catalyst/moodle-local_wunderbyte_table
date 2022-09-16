// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.

/*
 * @package    local_wunderbyte_table
 * @copyright Wunderbyte GmbH <info@wunderbyte.at>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import Ajax from 'core/ajax';
import Templates from 'core/templates';
import Notification from 'core/notification';

import {initializeCheckboxes, getFilterOjects} from 'local_wunderbyte_table/filter';
import {initializeSearch, getSearchInput} from 'local_wunderbyte_table/search';
import {initializeSort, getSortSelection} from 'local_wunderbyte_table/sort';
import {initializeReload} from 'local_wunderbyte_table/reload';


// All these variables will be objects with the idstringso their tables as identifiers.
var loadings = {};
var scrollpages = {};
var tablejss = {};
var scrollingelement = {};

/**
 * Gets called from mustache template.
 * @param {string} idstring
 * @param {string} encodedtable
 */
export const init = (idstring, encodedtable) => {

    // eslint-disable-next-line no-console
    console.log('wb init', idstring);

    if (idstring && encodedtable) {

        if (!scrollpages.hasOwnProperty(idstring)) {
            scrollpages[idstring] = 0;
        }

        respondToVisibility(idstring, encodedtable, callLoadData);
    }
};

/**
 * React on visibility change.
 * @param {string} idstring
 * @param {string} encodedtable
 * @param {function} callback
 */
function respondToVisibility(idstring, encodedtable, callback) {

    const identifier = 'a' + idstring;
    let element = document.querySelector('#' + identifier);

    // If we find the table element AND if it has the encoded table set, we abort this.
    // Hereby we avoid to run JS multiple times.
    if (element && !element.dataset.encodedtable) {
        element.dataset.encodedtable = encodedtable;
    } else {
        // eslint-disable-next-line no-console
        console.log('wb didnnt find element aborted', identifier);
        return;
    }

    // We only make this callback during init if there is the spinner running.
    // We don't want to run all of this if we don't use lazyloading.
    let spinner = document.querySelector("#" + identifier + 'spinner');

    if ((spinner !== null) && !isHidden(spinner)) {

        var observer = new MutationObserver(function() {
            if (!isHidden(element)) {
                this.disconnect();

                callback(idstring, encodedtable);
            }
        });

        const hiddenElement = returnHiddenElement(element);

        if (hiddenElement !== null) {

            observer.observe(hiddenElement, {attributes: true});
        } else {
            callback(idstring, encodedtable);
        }

    } else {

        // This is what we do when we didn't lazyload.
        replaceLinksInFrag(idstring, encodedtable, element, null);

        const selector = ".wunderbyte_table_container_" + idstring;
        initializeCheckboxes(selector, idstring, encodedtable);
        initializeSearch(selector, idstring, encodedtable);
        initializeSort(selector, idstring, encodedtable);
        initializeReload(selector, idstring, encodedtable);

        // Check to see if scrolling near bottom of page; load more photos
        // This shoiuld only be added once.

        // As this can only be here once per table, we mark the table.
        addScrollFunctionality(idstring, encodedtable, element);

    }
}

/**
 * Return the next scrollable element.
 * @param {*} node
 * @returns {*} node
 */
function getScrollParent(node) {
    if (node === null) {
      return null;
    }

    if (node.scrollHeight > node.clientHeight) {
      return node;
    } else {
      return getScrollParent(node.parentNode);
    }
  }

/**
 * Function to check visibility of element.
 * @param {*} el
 * @returns {boolean}
 */
 export const isHidden = (el) => {
    var style = window.getComputedStyle(el);
    return ((style.display === 'none') || (style.visibility === 'hidden'));
};

/**
 * Reloads the rendered table and sets it to the div with the right identifier.
 * @param {string} idstring
 * @param {string} encodedtable
 * @param {null|int} page
 * @param {null|string} tsort
 * @param {null|string} thide
 * @param {null|string} tshow
 * @param {null|int} tdir
 * @param {null|int} treset
 * @param {null|string} filterobjects
 * @param {null|string} searchtext
 * @param {null|bool} replacerow
 */
export const callLoadData = (
    idstring,
    encodedtable,
    page = null,
    tsort = null,
    thide = null,
    tshow = null,
    tdir = null,
    treset = null,
    filterobjects = null,
    searchtext = null,
    replacerow = false) => {

    if (loadings[idstring]) {
        return;
    }

    // We reset scrollpage with 0 when we come from the filter.
    if (page !== null) {
        scrollpages[idstring] = page;
    }

    // We always have to see if we need to apply a filter. Reload might come from scroll, but filter has to be applied nevertheless.
    if (filterobjects === null) {
        filterobjects = getFilterOjects(idstring);
    }
    // We always have to see if we need to apply a serachtextfilter.
    if (searchtext === null) {
        searchtext = getSearchInput(idstring);
    }
    // We always have to see if we need to apply a sortorder.
    if (tsort === null) {
        tsort = getSortSelection(idstring);
    }

    let table = document.getElementById('a' + idstring);

    // This is now the individual spinner from the wunderbyte table template.
    let spinner = document.querySelector('#a' + idstring + 'spinner .spinner-border');

    // If we replace the whole table, we show the spinner. If we only add rows in infinite scroll, we don't.
    if (scrollpages[idstring] == 0
            && !replacerow) {
        if (spinner) {
            spinner.classList.remove('hidden');
        }
        if (table) {
            table.classList.add('hidden');
        }
    }

    loadings[idstring] = true;

    Ajax.call([{
        methodname: "local_wunderbyte_table_load_data",
        args: {
            'encodedtable': encodedtable,
            'page': page,
            'tsort': tsort,
            'thide': thide,
            'tshow': tshow,
            'tdir': tdir,
            'treset': treset,
            'filterobjects': filterobjects,
            'searchtext': searchtext
        },
        done: function(res) {

            let jsonobject = JSON.parse(res.content);
            let rendertemplate = res.template;

            // We can always expect a wunderbyte table container at this point.
            // The container will hold wunderbyteTableClass, wunderbyteTableFilter, wunderbyteTableSearch classes.
            let container = document.querySelector(".wunderbyte_table_container_" + idstring);
            const componentscontainer = container.querySelector(".wunderbyte_table_components");

            // If we only increase the scrollpage, we don't need to render everything again.
            if (replacerow
                || (scrollpages[idstring] > 0)) {

                // Also, we want to use the table instead of the container template.
                const rowtemplate = rendertemplate + '_row';

                if (!jsonobject.table.hasOwnProperty('rows')) {
                    // We set the scrollpage to -1 which means that we don't reload anymore.
                    scrollpages[idstring] = -1;
                    loadings[idstring] = false;
                    return;
                }
                let rows = jsonobject.table.rows;

                // We create an array of promises where every line is rendered individually.
                const promises = rows.map(row => {
                    Templates.renderForPromise(rowtemplate, row).then(({html, js}) => {

                        if (replacerow) {

                            // We need the id.
                            const filterobject = JSON.parse(filterobjects);
                            const rowid = filterobject.id;

                            Templates.replaceNode("#a" + idstring
                                + " .rows-container tr[data-id='" + rowid + "']", html, js);
                        } else {
                            // Here we add the rendered content to the table div.
                            Templates.appendNodeContents('#a' + idstring + " .rows-container", html, js);
                        }

                        return true;
                    }).catch(e => {
                        // eslint-disable-next-line no-console
                        console.log(e);
                    });
                    return true;
                });

                if (!tablejss.hasOwnProperty(idstring)) {
                    // eslint-disable-next-line no-unused-vars
                    const promise = Templates.renderForPromise(rendertemplate, jsonobject).then(({html, js}) => {

                        tablejss[idstring] = js;
                        return true;
                    }).catch(e => {
                        // eslint-disable-next-line no-console
                        console.log(e);
                    });

                    promises.push(promise);
                }

                // Once all the promises are fullfilled, we set loading to false.
                Promise.all(promises).then(() => {

                    setTimeout(() => {
                        // We only added rows, but they might need some js from the table, so we add the table js again.
                        Templates.appendNodeContents('#a' + idstring, '', tablejss[idstring]);

                    }, 100);

                    loadings[idstring] = false;

                    return;
                }).catch(e => {
                    // eslint-disable-next-line no-console
                    console.log(e);
                });

                return;

            }

            if (!componentscontainer) {
                // If the componentscontainer is not yet rendered, we render the container. else, only the table.
                rendertemplate = rendertemplate + '_container';
            }

            let frag = container.querySelector(".wunderbyteTableClass");

            // We render the html with the right template.
            Templates.renderForPromise(rendertemplate, jsonobject).then(({html, js}) => {

                if (componentscontainer) {
                    // Now we clean the existing table.
                    while (frag.firstChild) {
                        frag.removeChild(frag.lastChild);
                    }

                    // Here we add the rendered content to the table div.
                    Templates.appendNodeContents('#a' + idstring, html, js);
                } else {
                    // Here we try to render the whole.hro
                    const parent = container.parentElement;
                    container.remove();
                    Templates.appendNodeContents(parent, html, js);

                    container = document.querySelector(".wunderbyte_table_container_" + idstring);
                }

                replaceLinksInFrag(idstring, encodedtable, container, page);

                // When everything is done, we loaded fine.
                loadings[idstring] = false;

                if (spinner) {
                    spinner.classList.add('hidden');
                }
                if (table) {
                    table.classList.remove('hidden');
                }

                // Make sure all elements are working.
                const selector = ".wunderbyte_table_container_" + idstring;
                initializeCheckboxes(selector, idstring, encodedtable);
                initializeSearch(selector, idstring, encodedtable);
                initializeSort(selector, idstring, encodedtable);

                const element = container.querySelector('#a' + idstring);

                // This is the place where we are after lazyloading. We check if we need to reinitialize scrolllistener:
                addScrollFunctionality(idstring, encodedtable, element);

                return true;
            }).catch(ex => {
                loadings[idstring] = false;
                Notification.addNotification({
                    message: 'failed rendering ' + ex,
                    type: "danger"
                });
            });
        },
        fail: function(err) {
            // If we have an error, resetting the table might be enough. we do that.
            // To avoid a loop, we only do this in special cases.
            if ((treset != 1)) {
                callLoadData(idstring, encodedtable, page, null, null, null, null, 1);
            } else {
                let node = document.createElement('DIV');
                let textnode = document.createTextNode(err.message);
                node.appendChild(textnode);
                table.appendChild(node);
                spinner.classList.add('hidden');
                table.classList.remove('hidden');
            }
        }
    }]);
};

/**
 * Add the scroll functionality to the right table.
 * @param {*} idstring
 * @param {*} encodedtable
 * @param {*} element
 * @returns {void}
 */
function addScrollFunctionality(idstring, encodedtable, element) {

    // eslint-disable-next-line no-console
    console.log("addScrollFunctionality");

    if (element.dataset.scrollinitialized) {
        return;
    }

    element.dataset.scrollinitialized = true;

    const scrollableelement = getScrollParent(element);

    // eslint-disable-next-line no-console
    console.log(scrollableelement);

    if (!scrollableelement) {
        return;
    }

    scrollableelement.addEventListener('scroll', () => {

        if (!scrollingelement.hasOwnProperty(idstring)) {
            scrollingelement[idstring] = 'scrollElement';
        } else {
            if (scrollingelement[idstring] === 'scrollElement') {
                scrollListener(element, idstring, encodedtable);
            }
        }
    });

    // It's not easy to decide which is the right, so we have to add both.
    window.addEventListener('scroll', () => {

        if (!scrollingelement.hasOwnProperty(idstring)) {
            scrollingelement[idstring] = 'window';
        } else {
            if (scrollingelement[idstring] === 'window') {
                scrollListener(element, idstring, encodedtable);
            }
        }
    });

}

/**
 * To be called in the scroll listener.
 * @param {node} element
 * @param {string} idstring
 * @param {string} encodedtable
 * @returns {void}
 */
function scrollListener(element, idstring, encodedtable) {
    // We only want to scroll, if the element is visible.
    // So, if we find a hidden element in the parent, we don't scroll.
    if (returnHiddenElement(element)) {
        return;
    }

    const elementtop = element.getBoundingClientRect().top;
    const elementheight = element.getBoundingClientRect().height;
    const screenheight = document.body.scrollHeight;

    if (!loadings[idstring] && scrollpages[idstring] >= 0) {
        if (elementtop + elementheight - screenheight < 0) {
            scrollpages[idstring] = scrollpages[idstring] + 1;
            callLoadData(idstring,
                    encodedtable,
                    scrollpages[idstring],
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null);
        }
    }
}

/**
 * If the element or one of its parents is hidden, we return it. the hiddenn element.
 * Else we return null.
 * @param {node} element
 * @returns {null|node}
 */
function returnHiddenElement(element) {
    // We look if we find a hidden parent. If not, we load right away.
    while (element !== null) {
        if (!isHidden(element)) {
            element = element.parentElement;
        } else {
            return element;
        }
    }
    return null;
}

/**
 * The rendered table has links we can't use. We replace them with eventlisteners and use the callLoadData function.
 * @param {string} idstring
 * @param {string} encodedtable
 * @param {DocumentFragment} frag
 * @param {int} page
 */
function replaceSortColumnLinks(idstring, encodedtable, frag, page) {

    var arrayOfItems = frag.querySelectorAll("th.header a");

    arrayOfItems.forEach(item => {
        var sortid = item.getAttribute('data-sortby');
        var sortorder = item.getAttribute('data-sortorder');
        var thide = item.getAttribute('data-action') == 'hide' ? item.getAttribute('data-column') : null;
        var tshow = item.getAttribute('data-action') == 'show' ? item.getAttribute('data-column') : null;

        item.setAttribute('href', '#');
        item.addEventListener('click', () => {
            callLoadData(idstring, encodedtable, page, sortid, thide, tshow, sortorder);
        });
    });
}

/**
 * The rendered table has links we can't use. We replace them with eventlisteners and use the callLoadData function.
 * @param {string} idstring
 * @param {string} encodedtable
 * @param {DocumentFragment} frag
 * @param {int} page
 */
function replaceResetTableLink(idstring, encodedtable, frag, page) {
    var arrayOfItems = frag.querySelectorAll("div.resettable");

    if (!arrayOfItems || arrayOfItems.length == 0) {
        return;
    }
    arrayOfItems.forEach(item => {
        var classofelement = item.getAttribute('class');
        if (classofelement.indexOf('resettable') >= 0) {
            let listOfChildren = item.querySelectorAll('a');
            listOfChildren.forEach(subitem => {
                subitem.setAttribute('href', '#');
                subitem.addEventListener('click', () => {
                    callLoadData(idstring, encodedtable, page, null, null, null, null, 1);
                });
            });
        }
    });
}

/**
 * The rendered table has links we can't use. We replace them with eventlisteners and use the callLoadData function.
 * @param {string} idstring
 * @param {string} encodedtable
 * @param {DocumentFragment} frag
 */
function replacePaginationLinks(idstring, encodedtable, frag) {
    var arrayOfPageItems = frag.querySelectorAll(".page-item");

    if (!arrayOfPageItems || arrayOfPageItems.length == 0) {
        return;
    }
    arrayOfPageItems.forEach(item => {

        let pageNumber = item.dataset.pagenumber;

        if (pageNumber) {
            --pageNumber;
            item.addEventListener('click', () => {
                callLoadData(idstring, encodedtable, pageNumber);
            });
        }
    });
}

/**
 * The rendered table has links we can't use. We replace them with eventlisteners and use the callLoadData function.
 * @param {string} idstring
 * @param {string} encodedtable
 * @param {DocumentFragment} frag
 */
function replaceDownloadLink(idstring, encodedtable, frag) {

    var arrayOfItems = frag.querySelectorAll("form");

    arrayOfItems.forEach(item => {
        if (item.tagName == 'FORM') {
            item.setAttribute('method', 'POST');
            let newnode = document.createElement('input');
            newnode.setAttribute('type', 'hidden');
            newnode.setAttribute('name', 'encodedtable');
            newnode.setAttribute('value', encodedtable);
            item.appendChild(newnode);
        }
    });
}

/**
 *
 * @param {*} idstring
 * @param {*} encodedtable
 * @param {*} frag
 * @param {*} page
 */
 function replaceLinksInFrag(idstring, encodedtable, frag, page = null) {

    if (!page) {
        const activepage = frag.querySelector('li.page-item active');
        if (activepage) {
            page = activepage.getAttribute('data-page-number');
        }
    }

    replaceDownloadLink(idstring, encodedtable, frag);
    replaceResetTableLink(idstring, encodedtable, frag, page);
    replacePaginationLinks(idstring, encodedtable, frag);
    replaceSortColumnLinks(idstring, encodedtable, frag, page);
}
