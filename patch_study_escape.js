<<<<<<< SEARCH
             if (w.tags && w.tags.length > 0) {
                 backHtml += `<div class="tags-container">`;
                 w.tags.forEach(tag => {
                     backHtml += `<span class="tag-badge">${escapeHTML(tag)}</span>`;
                 });
                 backHtml += `</div>`;
             }
=======
             if (w.tags && w.tags.length > 0) {
                 backHtml += `<div class="tags-container">`;
                 w.tags.forEach(tag => {
                     // escapeHTML is not defined in study.js
                     const safeTag = tag.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
                     backHtml += `<span class="tag-badge">${safeTag}</span>`;
                 });
                 backHtml += `</div>`;
             }
>>>>>>> REPLACE
