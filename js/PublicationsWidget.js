var PublicationsWidget = (function() {

		// Default configurations to be used by our widget
		var config = {
		
			sources: {
				"FlyMine": "http://beta.flymine.org/beta/service/query/results",  
				"YeastMine": "http://yeastmine.yeastgenome.org/yeastmine/service/query/results"
			},
			configKeyword: "Micklem G",
			configTarget: "body"
		
		};

		/**
		* Begins the process of building our publications table.
		*/
		function widget() {
	
			// Let the user know that we're fetching the data...
			$(config.configTarget).prepend ('<div> Loading...<img src="images/loading.gif" /></div>');

			// Query our mines listed in our configuration...
			// (Use a callback so we know when we're done)
			getData(config.sources, config.configKeyword, function(results) {
				
				// Get back a Backbone Collection of Publication models
				var allPublications = populatePublications(results);
				
				// Create our view and pass it our Collection
				this.view = new PublicationsTable({
					'collection': allPublications
				});

				// Render our results to the page
				this.view.render();
			});
		}
		

		/**
		* Get the results from our mines
		* @param sources array of sources to query
		* @param key keyword to search for
		* @callBack callback function to indicate we're finished
		* @return callback containing array of results
		*/
		function getData(sources, key, callBack)
		{
		
			// Will contain our results form each mine...
			var jsonResults = new Array();
			
			// Stores our AJAX requests (used to keep things in sync)...
			var ajaxReqs = [];
			
			// Loop through our sources and build an AJAX request for each one...
			for (source in sources) {

				var nextAJAXCall = $.ajax({
					
					type: 'POST',
					mySource: source, // Pass this in for storage (used below)
					url: sources[source],
					data: { 
						'query': '<query model="genomic" view="Author.publications.pubMedId\
								Author.publications.title Author.publications.journal\
								Author.publications.year Author.publications.authors.name" >\
								<join path="Author.publications.authors" style="OUTER"/>\
								<constraint path="Author.name"\
								op="CONTAINS" value="' + key + '" code="A" /> </query>',
						'format': 'json'
					},
					success: function(msg){
					
						// Get the results portion of our JSON response
						var myResults = msg.results;
						
						// Since our results are coming back as arrays without keys, we
						// will build objects with attributes for easier use
						for (var i = 0; i < msg.results.length; i++) {
							var unformattedResult = msg.results[i];
							var formattedResult = {

								"pubMedId": unformattedResult[0],
								"title": unformattedResult[1],
								"journal": unformattedResult[2],
								"year": unformattedResult[3],
								// Store the following attributes as arrays since
								// our Models can potentially have more than one value...
								"authors": new Array(unformattedResult[4]),
								"sources": new Array(this.mySource)
							}
							
							// Push our newly formatted object into our results...					
							jsonResults.push(formattedResult);
						}
					}
				}); // End of AJAX object
				
				// Push our AJAX call into our call array...
				ajaxReqs.push(nextAJAXCall);
			}
			
			// When we're done calling our AJAX objects, return the total results...
			$.when.apply($, ajaxReqs).then(function() {
				return callBack(jsonResults);
			});
		}

		/**
		* Turn our query results into Publication objects and then
		* add them to a Publications Collection
		* @param pubObject objects representing our query results
		* @return Collection of publications
		*/
		function populatePublications(pubObject){

			// Create a Publications Collection
			var publications = new Publications;

			for (var i = 0; i < pubObject.length; i++) { 

				var nextObj = pubObject[i];
				
				// Check to see if we have already created a publication
				// model for our PubMedID...
				var found = publications.find(function(item){
					return (item.get('pubMedId')) == nextObj.pubMedId;
				});

				if (found == null)
				{
					// We did not find an existing publication so create one using our
					// objects attributes...
					nextPublication = new Publication;
					nextPublication.set(nextObj);
					
					// Add the publication to our collection...
					publications.add(nextPublication);

				} else {
					
					// If we already have a publication then we need to apply logic
					// to combine our data.
					
					// We don't want duplicate authors, so trust only one source.
					// Let's use the first source that we find.
					sourcesList = found.get('sources');
					if (sourcesList[0] == nextObj.sources[0])
					{
						// Get the authors from the current publication model...
						var authorsList = found.get('authors');
						
						// Push the author from the current object...
						authorsList.push(nextObj.authors[0]);
						
						// Set the new array of authors on our publication model...
						found.set('authors', authorsList);
					}
					
					// Now add our source if it doesn't exist on the model...
					if (sourcesList.indexOf(nextObj.sources[0]) < 0)
					{
						
						// Push the source from the current object...
						sourcesList.push(nextObj.sources[0]);
						
						// Set the new array of sources on our publication model...
						found.set('sources', sourcesList);
					}

				}

			}

			return publications;

		} // End of function

	Publication =  Backbone.Model.extend({

	});


	Publications = Backbone.Collection.extend({

		model: Publication

	});

	
	PublicationsTable = Backbone.View.extend({

		render : function () {
		
			// Create our template and pass it our attributes
			var content = _.template(publicationsTemplate, {
				rows: this.collection.models,
				params: config.configKeyword,
				count: this.collection.length });

			// Set the HTML of target to our compiled template
			$(config.configTarget).html(content);

		}
	   

	});
	
	// Return a public method so that our user can specify search attributes
	return {
		
		/**
		* This function tells the widget to do our search and should
		* be called by our web browser.
		* @param container the container to store our publications
		* @param keyword the keyword for which we're searching our mines
		*/		
		initial: function(keyword, container){
		
			config.configTarget = container;
			config.configKeyword = keyword;
			
			//onsole.log("initial called with: " + container);
			widget();
		}
		
	};
	
})();

// Stored here to avoid needing to include another JS file in our web page
var publicationsTemplate = '\
	<table> \
		<caption>Found <%= count %> publications for authors matching the keyword <%= params %></caption> \
		<thead> \
			<tr> \
				<th width="30%">Title</th> \
				<th>Journal</th> \
				<th>Authors</th> \
				<th>Source</th> \
			</tr> \
		</thead> \
		<tbody> \
			<% rows.forEach(function (row) { %> \
				<tr> \
					<td><a href="http://www.ncbi.nlm.nih.gov/pubmed/<%= row.get("pubMedId") %>"><%= row.get("title") %></a></td> \
					<td><%= row.get("journal") %></td> \
					<td> \
						<% row.get("authors").forEach(function (author, i) { %> \
						<%if (i>0) {%>,<%}%> \
						<%=author%> \
						<% }); %> \
					</td> \
					<td> \
						<% row.get("sources").forEach(function (source, i) { %> \
						<div class="source"><%=source%></div> \
						<% }); %> \
					</td> \
				</tr> \
			<% }); %> \
		</tbody> \
	</table> \
	';




