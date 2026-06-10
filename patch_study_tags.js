<<<<<<< SEARCH
             // Tags (Bottom of card word-block)
             if (w.tags && w.tags.length > 0) {
                 backHtml += `<div class="tags-container mt-6">`;
                 w.tags.forEach(tag => {
                     const safeTag = tag.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
                     backHtml += `<span class="tag-badge">${safeTag}</span>`;
                 });
                 backHtml += `</div>`;
             }

             // Examples
=======
             // Examples
>>>>>>> REPLACE
<<<<<<< SEARCH
             backHtml += `</div>`; // Close word block
=======
             // Tags (Bottom of card word-block)
             if (w.tags && w.tags.length > 0) {
                 backHtml += `<div class="tags-container mt-6">`;
                 w.tags.forEach(tag => {
                     const safeTag = tag.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
                     backHtml += `<span class="tag-badge">${safeTag}</span>`;
                 });
                 backHtml += `</div>`;
             }

             backHtml += `</div>`; // Close word block
>>>>>>> REPLACE
