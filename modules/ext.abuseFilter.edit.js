/**
 * AbuseFilter editing JavaScript
 *
 * @author John Du Hart
 * @author Marius Hoch <hoo@online.de>
 */
/* global ace */

( function ( mw, $, OO ) {
	'use strict';

	// @var {jQuery} Filter editor for JS and jQuery handling
	var $filterBox,
		// Filter editor for Ace specific functions
		filterEditor,
		// @var {jQuery} Hidden textarea for submitting form
		$plainTextBox,
		// @var {boolean} To determine what editor to use
		useAce = false,
		// Infused OOUI elements
		togglePreviewButton,
		messageExisting,
		messageOther;

	/**
	 * Returns the currently selected warning message
	 *
	 * @return {string} current warning message
	 */
	function getCurrentWarningMessage() {
		var message = messageExisting.getValue();

		if ( message === 'other' ) {
			message = messageOther.getValue();
		}

		return message;
	}

	/**
	 * Things always needed after syntax checks
	 *
	 * @param {string} resultText The message to show, telling if the syntax is valid
	 * @param {string} className Class to add
	 * @param {boolean} syntaxOk Is the syntax ok?
	 */
	function processSyntaxResultAlways( resultText, className, syntaxOk ) {
		$.removeSpinner( 'abusefilter-syntaxcheck' );
		$( '#mw-abusefilter-syntaxcheck' ).prop( 'disabled', false );

		$( '#mw-abusefilter-syntaxresult' )
			.show()
			.attr( 'class', className )
			.text( resultText )
			.data( 'syntaxOk', syntaxOk );
	}

	/**
	 * Switch between Ace Editor and classic textarea
	 */
	function switchEditor() {
		if ( useAce ) {
			useAce = false;
			$filterBox.hide();
			$plainTextBox.show();
		} else {
			useAce = true;
			filterEditor.session.setValue( $plainTextBox.val() );
			$filterBox.show();
			$plainTextBox.hide();
		}
	}

	/**
	 * Takes the data retrieved in doSyntaxCheck and processes it
	 *
	 * @param {Object} response Data returned from the AJAX request
	 */
	function processSyntaxResult( response ) {
		var position,
			data = response.abusefilterchecksyntax;

		if ( data.status === 'ok' ) {
			// Successful
			processSyntaxResultAlways(
				mw.msg( 'abusefilter-edit-syntaxok' ),
				'mw-abusefilter-syntaxresult-ok',
				true
			);
		} else {
			// Set a custom error message as we're aware of the actual problem
			processSyntaxResultAlways(
				mw.message( 'abusefilter-edit-syntaxerr', data.message ).toString(),
				'mw-abusefilter-syntaxresult-error',
				false
			);

			if ( useAce ) {
				filterEditor.focus();
				// Convert index (used in textareas) in position {row, column} for ace
				position = filterEditor.session.getDocument().indexToPosition( data.character );
				filterEditor.navigateTo( position.row, position.column );
				filterEditor.scrollToRow( position.row );
			} else {
				$plainTextBox
					.focus()
					.textSelection( 'setSelection', { start: data.character } );
			}
		}
	}

	/**
	 * Acts on errors after doSyntaxCheck
	 *
	 * @param {string} error Error code returned from the AJAX request
	 * @param {Object} details Details about the error
	 */
	function processSyntaxResultFailure( error, details ) {
		var msg = error === 'http' ? 'abusefilter-http-error' : 'unknown-error';
		processSyntaxResultAlways(
			mw.msg( msg, details && details.exception ),
			'mw-abusefilter-syntaxresult-error',
			false
		);
	}

	/**
	 * Sends the current filter text to be checked for syntax issues.
	 *
	 * @context HTMLElement
	 * @param {jQuery.Event} e The event fired when the function is called
	 */
	function doSyntaxCheck() {
		var filter = $plainTextBox.val(),
			api = new mw.Api();

		$( this )
			.prop( 'disabled', true )
			.injectSpinner( { id: 'abusefilter-syntaxcheck', size: 'large' } );

		api.post( {
			action: 'abusefilterchecksyntax',
			filter: filter
		} )
			.done( processSyntaxResult )
			.fail( processSyntaxResultFailure );
	}

	/**
	 * Adds text to the filter textarea
	 * Fired by a change event from the #wpFilterBuilder dropdown
	 */
	function addText() {
		var $filterBuilder = $( '#wpFilterBuilder' );

		if ( $filterBuilder.prop( 'selectedIndex' ) === 0 ) {
			return;
		}

		if ( useAce ) {
			filterEditor.insert( $filterBuilder.val() + ' ' );
			$plainTextBox.val( filterEditor.getSession().getValue() );
			filterEditor.focus();
		} else {
			$plainTextBox.textSelection(
				'encapsulateSelection', { pre: $filterBuilder.val() + ' ' }
			);
		}
		$filterBuilder.prop( 'selectedIndex', 0 );
	}

	/**
	 * Fetches a filter from the API and inserts it into the filter box.
	 *
	 * @context HTMLElement
	 * @param {jQuery.Event} e The event fired when the function is called
	 */
	function fetchFilter() {
		var filterId = $.trim( $( '#mw-abusefilter-load-filter input' ).val() ),
			api;

		if ( filterId === '' ) {
			return;
		}

		$( this ).injectSpinner( { id: 'fetch-spinner', size: 'large' } );

		// We just ignore errors or unexisting filters over here
		api = new mw.Api();
		api.get( {
			action: 'query',
			list: 'abusefilters',
			abfprop: 'pattern',
			abfstartid: filterId,
			abfendid: filterId,
			abflimit: 1
		} )
			.always( function removeSpinner() {
				$.removeSpinner( 'fetch-spinner' );
			} )
			.done( function insertFilter( data ) {
				if ( data.query.abusefilters[ 0 ] !== undefined ) {
					if ( useAce ) {
						filterEditor.setValue( data.query.abusefilters[ 0 ].pattern );
					}
					$plainTextBox.val( data.query.abusefilters[ 0 ].pattern );
				}
			} );
	}

	/**
	 * Cycles through all action checkboxes and hides parameter divs
	 * that don't have checked boxes
	 */
	function hideDeselectedActions() {
		$( '.mw-abusefilter-action-checkbox input' ).each( function showHideParams() {
			// mw-abusefilter-action-checkbox-{$action}
			var action = this.parentNode.id.substr( 31 ),
				$params = $( '#mw-abusefilter-' + action + '-parameters' );

			if ( $params.length ) {
				if ( this.checked ) {
					$params.show();
				} else {
					$params.hide();
				}
			}
		} );
	}

	/**
	 * Fetches the selected warning message for previewing
	 */
	function previewWarnMessage() {
		var api = new mw.Api(),
			args = [
				'<nowiki>' + $( 'input[name=wpFilterDescription]' ).val() + '</nowiki>',
				$( '#mw-abusefilter-edit-id' ).children().last().text()
			],
			message = getCurrentWarningMessage(),
			isVisible = $( '#mw-abusefilter-warn-preview' ).is( ':visible' );

		if ( isVisible ) {
			$( '#mw-abusefilter-warn-preview' ).hide();
			togglePreviewButton.setFlags( { destructive: false, progressive: true } );
		} else {
			api.get( {
				action: 'query',
				meta: 'allmessages',
				ammessages: message,
				amargs: args.join( '|' )
			} )
				.done( function parseMessage( data ) {
					api.parse( data.query.allmessages[ 0 ][ '*' ], {
						disablelimitreport: '',
						preview: '',
						prop: 'text',
						title: 'MediaWiki:' + message
					} )
						.done( function showMessage( html ) {
							$( '#mw-abusefilter-warn-preview' ).show().html( html );
							togglePreviewButton.setFlags(
								{ destructive: true, progressive: false }
							);
						} );
				} );
		}
	}

	/**
	 * Redirects the browser to the warning message for editing
	 */
	function editWarnMessage() {
		var message = getCurrentWarningMessage();

		window.location = mw.config.get( 'wgScript' ) +
			'?title=MediaWiki:' + mw.util.wikiUrlencode( message ) +
			'&action=edit&preload=MediaWiki:abusefilter-warning';
	}

	/**
	 * Called if the filter group (#mw-abusefilter-edit-group-input select) is changed.
	 *
	 * @context HTMLELement
	 * @param {jQuery.Event} e The event fired when the function is called
	 */
	function onFilterGroupChange() {
		var $afWarnMessageExisting, newVal;

		if ( !$( '#mw-abusefilter-action-warn-checkbox' ).is( ':checked' ) ) {
			$afWarnMessageExisting = $( '#mw-abusefilter-warn-message-existing select' );
			newVal = mw.config.get( 'wgAbuseFilterDefaultWarningMessage' )[ $( this ).val() ];

			if ( $afWarnMessageExisting.find( 'option[value=\'' + newVal + '\']' ).length ) {
				$afWarnMessageExisting.val( newVal );
				messageOther.setValue( '' );
			} else {
				$afWarnMessageExisting.val( 'other' );
				messageOther.setValue( newVal );
			}
		}
	}

	/**
	 * Remove the options for warning messages if the filter is set to global
	 */
	function toggleCustomMessages() {
		// Use the table over here as hideDeselectedActions might alter the visibility of the div
		var $warnOptions = $( '#mw-abusefilter-warn-parameters > table' );

		if ( $( '#wpFilterGlobal' ).is( ':checked' ) ) {
			// It's a global filter, so use the default message and hide the option from the user
			messageExisting.setValue( 'abusefilter-warning' );

			$warnOptions.hide();
		} else {
			$warnOptions.show();
		}
	}

	/**
	 * Called if the user presses a key in the load filter field
	 *
	 * @context HTMLELement
	 * @param {jQuery.Event} e The event fired when the function is called
	 */
	function onFilterKeypress( e ) {
		if ( e.type === 'keypress' && e.which === 13 ) {
			e.preventDefault();
			$( '#mw-abusefilter-load' ).click();
		}
	}

	// On ready initialization
	$( document ).ready( function () {
		var basePath, readOnly,
			$exportBox = $( '#mw-abusefilter-export' ),
			isFilterEditor = mw.config.get( 'isFilterEditor' ),
			tagConfig = mw.config.get( 'tagConfig' ),
			$tagContainer, tagUsed, tagDisabled, tagSelector, tagField,
			tagHiddenField, cbEnabled, cbDeleted;

		if ( isFilterEditor ) {
			// Configure the actual editing interface
			if ( tagConfig ) {
				// Build the tag selector
				$tagContainer = $( '#mw-abusefilter-tag-parameters' );
				tagUsed = tagConfig.tagUsed;
				tagDisabled = tagConfig.tagDisabled.length !== 0;
				// Input field for tags
				tagSelector =
					new OO.ui.TagMultiselectWidget( {
						inputPosition: 'outline',
						allowArbitrary: true,
						allowEditTags: true,
						selected: tagUsed,
						placeholder: tagConfig.tagPlaceholder,
						disabled: tagDisabled
					} );
				tagField =
					new OO.ui.FieldLayout(
						tagSelector,
						{
							label: $( $.parseHTML( tagConfig.tagLabel ) ),
							align: 'top'
						}
					);
				tagHiddenField = OO.ui.infuse( $( '#mw-abusefilter-hidden-tags-field' ) );
				tagSelector.on( 'change', function () {
					tagHiddenField.setValue( tagSelector.getValue() );
				} );

				$( '#mw-abusefilter-hidden-tags' ).hide();
				$tagContainer.append( tagField.$element );
			}

			togglePreviewButton = OO.ui.infuse( $( '#mw-abusefilter-warn-preview-button' ) );
			messageExisting = OO.ui.infuse( $( '#mw-abusefilter-warn-message-existing' ) );
			messageOther = OO.ui.infuse( $( '#mw-abusefilter-warn-message-other' ) );
		}

		$plainTextBox = $( '#' + mw.config.get( 'abuseFilterBoxName' ) );

		if ( $( '#wpAceFilterEditor' ).length ) {
			// CodeEditor is installed.
			mw.loader.using( [ 'ext.abuseFilter.ace' ] ).then( function () {
				$filterBox = $( '#wpAceFilterEditor' );

				filterEditor = ace.edit( 'wpAceFilterEditor' );
				filterEditor.session.setMode( 'ace/mode/abusefilter' );

				// Ace setup from codeEditor extension
				basePath = mw.config.get( 'wgExtensionAssetsPath', '' );
				if ( basePath.slice( 0, 2 ) === '//' ) {
					// ACE uses web workers, which have importScripts, which don't like
					// relative links. This is a problem only when the assets are on another
					// server, so this rewrite should suffice.
					basePath = window.location.protocol + basePath;
				}
				ace.config.set( 'basePath', basePath + '/CodeEditor/modules/ace' );

				// Settings for Ace editor box
				readOnly = mw.config.get( 'aceConfig' ).aceReadOnly;

				filterEditor.setTheme( 'ace/theme/textmate' );
				filterEditor.session.setOption( 'useWorker', false );
				filterEditor.setReadOnly( readOnly );
				filterEditor.$blockScrolling = Infinity;

				// Display Ace editor
				switchEditor();

				// Hide the syntax ok message when the text changes and sync dummy box
				filterEditor.on( 'change', function () {
					var $el = $( '#mw-abusefilter-syntaxresult' );

					if ( $el.data( 'syntaxOk' ) ) {
						$el.hide();
					}

					$plainTextBox.val( filterEditor.getSession().getValue() );
				} );

				$( '#mw-abusefilter-switcheditor' ).click( switchEditor );
			} );
		}

		// Hide the syntax ok message when the text changes
		$plainTextBox.change( function () {
			var $el = $( '#mw-abusefilter-syntaxresult' );

			if ( $el.data( 'syntaxOk' ) ) {
				$el.hide();
			}
		} );

		$( '#mw-abusefilter-load' ).click( fetchFilter );
		$( '#mw-abusefilter-load-filter' ).keypress( onFilterKeypress );

		if ( isFilterEditor ) {
			// Add logic for flags and consequences
			$( '#mw-abusefilter-warn-preview-button' ).click( previewWarnMessage );
			$( '#mw-abusefilter-warn-edit-button' ).click( editWarnMessage );
			$( '.mw-abusefilter-action-checkbox input' ).click( hideDeselectedActions );
			hideDeselectedActions();

			$( '#wpFilterGlobal' ).change( toggleCustomMessages );
			toggleCustomMessages();

			cbEnabled = OO.ui.infuse( $( '#wpFilterEnabled' ) );
			cbDeleted = OO.ui.infuse( $( '#wpFilterDeleted' ) );
			OO.ui.infuse( $( '#wpFilterDeletedLabel' ) );
			cbEnabled.on( 'change',
				function () {
					cbDeleted.setDisabled( cbEnabled.isSelected() );
					if ( cbEnabled.isSelected() ) {
						cbDeleted.setSelected( false );
					}
				}
			);

			cbDeleted.on( 'change',
				function () {
					if ( cbDeleted.isSelected() ) {
						cbEnabled.setSelected( false );
					}
				}
			);

			$( '#mw-abusefilter-edit-group-input select' ).change( onFilterGroupChange );

			$( '#mw-abusefilter-export-link' ).click(
				function ( e ) {
					e.preventDefault();
					$exportBox.toggle();
				}
			);
		}

		$( '#mw-abusefilter-syntaxcheck' ).click( doSyntaxCheck );
		$( '#wpFilterBuilder' ).change( addText );

	} );
}( mediaWiki, jQuery, OO ) );